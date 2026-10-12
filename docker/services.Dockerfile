# The Python services (scripts/calibre/). One file, three targets:
#   base        accounts and the catalog builder (Python standard library + Pillow)
#   import      + Calibre, for adding books to the library (large)
#   difficulty  + Sudachi and ONNX Runtime, for Jiten's difficulty model (large)
# Built by docker-compose.yml from the repository root. Runs as PUID (compose `user:`).

FROM debian:trixie-slim AS base
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-pil ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY scripts/calibre/build-catalog.py scripts/calibre/assign-series.py /app/
COPY scripts/calibre/account /app/account
COPY scripts/calibre/import /app/import
RUN ln -s /app/build-catalog.py /usr/local/bin/build-calibre-catalog \
  && printf '#!/bin/sh\nexec python3 /app/account/service.py "$@"\n' > /usr/local/bin/ebook-account \
  && chmod 755 /app/build-catalog.py /usr/local/bin/ebook-account
ENV PYTHONUNBUFFERED=1 \
  CALIBRE_LIBRARY=/library \
  SHARED_SYNC_DIR=/data/sync \
  ACCOUNT_STATE_DIR=/data/state/account \
  ACCOUNT_DATA_DIR=/data/accounts \
  ACCOUNT_HOST=0.0.0.0 \
  CATALOG_OUTPUT=/data/state/catalog/catalog.json \
  CALIBRE_CATALOG=/data/state/catalog/catalog.json \
  IMPORT_STATE_DIR=/data/state/import \
  IMPORT_HOST=0.0.0.0 \
  CALIBRE_WRITE_LOCK=/data/state/import/calibre-write.lock \
  JITEN_STATE_DIR=/data/state/difficulty \
  JITEN_HOST=0.0.0.0
CMD ["python3", "/app/account/service.py", "serve"]

FROM base AS import
RUN apt-get update \
  && apt-get install -y --no-install-recommends calibre \
  && rm -rf /var/lib/apt/lists/*
ENV HOME=/data/state/import QT_QPA_PLATFORM=offscreen
CMD ["python3", "/app/import/service.py"]

FROM base AS difficulty
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3-venv \
  && rm -rf /var/lib/apt/lists/*
COPY scripts/calibre/jiten/requirements.txt /app/jiten/requirements.txt
RUN python3 -m venv /opt/venv && /opt/venv/bin/pip install --no-cache-dir -r /app/jiten/requirements.txt
COPY scripts/calibre/jiten /app/jiten
CMD ["/opt/venv/bin/python", "-W", "ignore", "/app/jiten/service.py", "serve"]
