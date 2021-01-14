#!/usr/bin/env bash
set -e

ERROR_FILE='/tmp/error.txt'

[ -z "$GIT_PROJECT_URL" ] && echo "GIT_PROJECT_URL is required" >> $ERROR_FILE && IS_ERROR=1

if [ -z "$GIT_SECRET" ]
then
    # no auth
    url="${GIT_PROJECT_URL}"
else
    # use secrets to pull
    regex="^(https|http):\/\/(.+)" 
    if [[ $GIT_PROJECT_URL =~ $regex ]]
    then
        protocol="${BASH_REMATCH[1]}"
        project_url="${BASH_REMATCH[2]}"    
    else
        echo "error matching project url (example: https://github.com/account-name/repo-name.git)" >> $ERROR_FILE 
        IS_ERROR=1
    fi
    url="${protocol}://${GIT_SECRET}@${project_url}"
fi

if [ -z "$IS_ERROR" ] 
then
    # no errors
    # clone repo
    # TODO: capture cloning errors
    git clone $url && cd `echo $(basename $_ .git)`

    # check entrypoint
    if [ -n "$ENTRY_POINT" ]; then
        echo 'check entrypoint'
        if [ ! -f "$ENTRY_POINT" ]; then
            echo "entry_point ${ENTRY_POINT} not exists" >> $ERROR_FILE 
            IS_ERROR=1
        fi
    fi

fi

if [ -z "$IS_ERROR" ] 
then
    # no errors
    exec "$@"
else
    # errors found
    streamlit run error.py
fi
