#!/usr/bin/env bash
set -e

[ -z "$GIT_PROJECT_URL" ] && echo "GIT_PROJECT_URL is required" && exit 1
[ -z "$GIT_SECRET" ] && echo "GIT_SECRET is required" && exit 1

# add secret to git project ul
regex="^(https|http):\/\/(.+)" 
if [[ $GIT_PROJECT_URL =~ $regex ]]
then
    protocol="${BASH_REMATCH[1]}"
    project_url="${BASH_REMATCH[2]}"    
else
    echo "doesn't match" 
    exit 1
fi

url="${protocol}://${GIT_SECRET}@${project_url}"
# clone and change dir
git clone $url && cd `echo $(basename $_ .git)`

exec "$@"