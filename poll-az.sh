#!/bin/bash

POLLING_INTERVAL_S=${WBA_POLLING_INTERVAL:-50}

mkdir -p dist
cd dist
az storage blob download-batch  --destination . --source $PUBLISH_LOCATION
cd ..

while :
do
  TARGET_TIME=$(date -d "+ $POLLING_INTERVAL_S seconds" +%s)
  npm run fetch
  cd dist
  az storage blob upload-batch  --source .  --destination $PUBLISH_LOCATION
  cd ..
  CURRENT_TIME=$(date +%s)
  SLEEP_TARGET=$(($TARGET_TIME - $CURRENT_TIME))
  echo "Sleep for ${SLEEP_TARGET}s"
  if [[ $SLEEP_TARGET -gt 0 ]]; then
    sleep $SLEEP_TARGET
  fi
done
