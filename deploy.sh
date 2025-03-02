#!/bin/bash

scp html/* root@good-neighbor.jumpingcrab.com:/var/www/html/
scp jsapp/* root@good-neighbor.jumpingcrab.com:/var/www/jsapp/
ssh root@good-neighbor.jumpingcrab.com systemctl restart jsapp