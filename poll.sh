#!/bin/bash

POLLING_INTERVAL_S=300

while :
do
  TARGET_TIME=$(date -d "+ $POLLING_INTERVAL_S seconds" +%s)
  npm run fetch
  cd dist
  git commit -a -m "Fetched files"
  git reset $(git commit-tree HEAD^{tree} -m "Fetched files")
  cd ..
  CURRENT_TIME=$(date +%s)
  SLEEP_TARGET=$(($TARGET_TIME - $CURRENT_TIME))
  echo "Sleep for ${SLEEP_TARGET}s"
  if [[ $SLEEP_TARGET -gt 0 ]]; then
    sleep $SLEEP_TARGET
  fi
done
