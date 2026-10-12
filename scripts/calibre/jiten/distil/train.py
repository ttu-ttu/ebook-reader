"""Distils jiten.moe's algorithmic scores into a local model. Evaluation is grouped by series."""
import json, math, os, sys
import numpy as np
import onnxruntime
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.model_selection import GroupKFold
HERE = os.path.dirname(os.path.abspath(__file__))
import ast  # noqa: E402
# Read FEATURE_ORDER without importing features.py (it needs Sudachi, not installed here).
FEATURE_ORDER = next(ast.literal_eval(n.value) for n in ast.parse(open(os.path.join(HERE, 'jiten', 'features.py')).read()).body
                     if isinstance(n, ast.Assign) and getattr(n.targets[0], 'id', '') == 'FEATURE_ORDER')

EXTRA = ['LogCharacters', 'LogUniqueKanji']
labels = json.load(open(os.path.join(HERE, 'labels.json')))
rows = [json.loads(l) for l in open(os.path.join(HERE, 'features.jsonl'))]
rows = [r for r in rows if 'error' not in r and str(r['id']) in labels]
print(len(rows), 'books with features and a label')

def matrix(variant):
    return np.array([[r[variant][k] for k in FEATURE_ORDER] + [math.log(r['characters']), math.log(max(r['uniqueKanji'], 10))]
                     for r in rows], dtype=np.float32)
y = np.array([labels[str(r['id'])]['score'] for r in rows])
groups = np.array([labels[str(r['id'])]['group'] for r in rows])

def report(name, pred):
    err = pred - y
    print(f'{name:28s} r={np.corrcoef(pred, y)[0, 1]:.3f}  MAE={np.abs(err).mean():.3f}  RMSE={math.sqrt((err ** 2).mean()):.3f}  bias={err.mean():+.3f}')

def model():
    # Classic gradient boosting: skl2onnx converts it reliably (HistGradientBoosting export fails).
    return GradientBoostingRegressor(n_estimators=600, learning_rate=0.03, max_depth=4, min_samples_leaf=20,
                                     subsample=0.8, random_state=0)
variant = 'features'
X = matrix(variant)
pred = np.zeros(len(y))
for train, test in GroupKFold(n_splits=5).split(X, y, groups):
    pred[test] = model().fit(X[train], y[train]).predict(X[test])
report('distilled (cross-validated)', pred)
err = np.sort(np.abs(pred - y))
print('abs error 50%/90%/99%:', *(round(float(err[int(len(err) * q)]), 3) for q in (0.5, 0.9, 0.99)))
json.dump({str(r['id']): round(float(p), 3) for r, p in zip(rows, pred)}, open(os.path.join(HERE, 'cv-predictions.json'), 'w'))

# Final model on everything, exported for onnxruntime with the service's input name.
from skl2onnx import to_onnx  # noqa: E402
final = model().fit(X, y)
from skl2onnx.common.data_types import FloatTensorType  # noqa: E402
onx = to_onnx(final, initial_types=[('float_input', FloatTensorType([None, X.shape[1]]))], target_opset=17)
out = os.path.join(HERE, 'difficulty_model_jiten_distilled.onnx')
open(out, 'wb').write(onx.SerializeToString())
check = onnxruntime.InferenceSession(out).run(None, {'float_input': X[:5]})[0].ravel()
print('exported', out, 'check', np.round(check, 2), 'vs', np.round(final.predict(X[:5]), 2))
