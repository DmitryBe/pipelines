#!/usr/bin/env bash
set -e

# (
#   set -Ee
#   function _catch {
#     echo 'B'
#   }
#   trap _catch ERR
#   echo 'A'
#   cat /tmp/error.txt1
# )

ENTRY_POINT=/tmp/error.txt

if [ -n "$ENTRY_POINT" ]; then
  echo 'var defined'
  if [ ! -f "$ENTRY_POINT" ]; then
    echo 'not exist'
  fi
fi

# if [! -z "$ENTRY_POINT"] || [ -f "$ENTRY_POINT" ]; then
#   echo "exists."
# else
#   echo 'not exist'
# fi