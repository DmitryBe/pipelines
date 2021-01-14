FROM python:3.7.9

COPY requirements.txt /
COPY entrypoint.sh /

RUN pip install -r /requirements.txt

ENTRYPOINT [ "/entrypoint.sh" ]
