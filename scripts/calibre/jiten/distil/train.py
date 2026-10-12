"""Trains chimi-difficulty on jiten.moe's algorithmic scores, plus 10th/90th percentile
models for a range. Evaluation is grouped by series."""
import ast, json, math, os
import numpy as np
import onnxruntime
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.model_selection import GroupKFold
HERE = os.path.dirname(os.path.abspath(__file__))


def constant(name):
    """A list constant of features.py, read without importing it (it needs Sudachi, not installed here)."""
    tree = ast.parse(open(os.path.join(HERE, 'jiten', 'features.py')).read())
    return next(ast.literal_eval(n.value) for n in tree.body
                if isinstance(n, ast.Assign) and getattr(n.targets[0], 'id', '') == name)


FEATURE_ORDER, EXTRA_FEATURES = constant('FEATURE_ORDER'), constant('EXTRA_FEATURES')
NAMES = FEATURE_ORDER + EXTRA_FEATURES
labels = json.load(open(os.path.join(HERE, 'labels.json')))
rows = [json.loads(l) for l in open(os.path.join(HERE, 'features.jsonl'))]
rows = [r for r in rows if 'error' not in r and str(r['id']) in labels]
print(len(rows), 'books with features and a label')

X = np.array([[r['features'][k] for k in FEATURE_ORDER] + [r['extra'][k] for k in EXTRA_FEATURES] for r in rows],
             dtype=np.float32)
y = np.array([labels[str(r['id'])]['score'] for r in rows])
groups = np.array([labels[str(r['id'])]['group'] for r in rows])


def model(**loss):
    # Classic gradient boosting: skl2onnx converts it reliably (HistGradientBoosting export fails).
    return GradientBoostingRegressor(n_estimators=600, learning_rate=0.03, max_depth=4, min_samples_leaf=20,
                                     subsample=0.8, random_state=0, **loss)


def cross_validate(columns, **loss):
    pred = np.zeros(len(y))
    for train, test in GroupKFold(n_splits=5).split(X, y, groups):
        pred[test] = model(**loss).fit(X[train][:, columns], y[train]).predict(X[test][:, columns])
    return pred


def report(name, pred):
    err = pred - y
    print(f'{name:34s} r={np.corrcoef(pred, y)[0, 1]:.3f}  MAE={np.abs(err).mean():.3f}  '
          f'RMSE={math.sqrt((err ** 2).mean()):.3f}  bias={err.mean():+.3f}')


everything = list(range(len(NAMES)))
# The previous model: Jiten's features plus log characters and log unique kanji.
report('previous inputs (cross-validated)', cross_validate(list(range(len(FEATURE_ORDER) + 2))))
pred = cross_validate(everything)
report('with extra features', pred)
err = np.sort(np.abs(pred - y))
print('abs error 50%/90%/99%:', *(round(float(err[int(len(err) * q)]), 3) for q in (0.5, 0.9, 0.99)))
low = cross_validate(everything, loss='quantile', alpha=0.1)
high = cross_validate(everything, loss='quantile', alpha=0.9)
print(f'10-90% range: holds {np.mean((y >= low) & (y <= high)):.0%} of books (aim 80%), '
      f'mean width {np.mean(high - low):.2f}')
# Quantile models are too sure of themselves on unseen books; conformalized quantile
# regression (Romano et al. 2019) widens the range by the 80% quantile of its misses.
widen = float(np.quantile(np.maximum(low - y, y - high), 0.8))
print(f'widened by {widen:.3f}: holds {np.mean((y >= low - widen) & (y <= high + widen)):.0%}, '
      f'mean width {np.mean(high - low) + 2 * widen:.2f}')
json.dump({'widen': round(widen, 4)}, open(os.path.join(HERE, 'chimi-difficulty-range.json'), 'w'))
json.dump({str(r['id']): round(float(p), 3) for r, p in zip(rows, pred)}, open(os.path.join(HERE, 'cv-predictions.json'), 'w'))

# Final models on everything, exported for onnxruntime with the service's input name.
from skl2onnx import to_onnx  # noqa: E402
from skl2onnx.common.data_types import FloatTensorType  # noqa: E402
for suffix, loss in (('', {}), ('-low', {'loss': 'quantile', 'alpha': 0.1}), ('-high', {'loss': 'quantile', 'alpha': 0.9})):
    final = model(**loss).fit(X, y)
    if not suffix:
        top = sorted(zip(final.feature_importances_, NAMES), reverse=True)[:15]
        print('most important:', ', '.join(f'{n} {v:.3f}' for v, n in top))
    onx = to_onnx(final, initial_types=[('float_input', FloatTensorType([None, X.shape[1]]))], target_opset=17)
    out = os.path.join(HERE, f'chimi-difficulty{suffix}.onnx')
    open(out, 'wb').write(onx.SerializeToString())
    check = onnxruntime.InferenceSession(out).run(None, {'float_input': X[:5]})[0].ravel()
    print('exported', out, 'check', np.round(check, 2), 'vs', np.round(final.predict(X[:5]), 2))
