import os
import argparse
import streamlit as st

error_file_path = '/error.txt'

if os.path.exists(error_file_path):
    with open(error_file_path) as f:
        err_msg = f.readlines()
else:
    err_msg = 'unknown error'

st.subheader('Error')
st.write(''.join(err_msg))