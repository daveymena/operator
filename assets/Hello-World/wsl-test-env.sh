#!/bin/bash
set -a
source /home/kenneth/Hello-World/.env
echo "PASS=$OPENCODE_SERVER_PASSWORD"
echo "PORT=$PORT"
env | grep OPENCODE
