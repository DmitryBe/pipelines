import os
import argparse
import streamlit as st

# pass params as args
# https://gist.github.com/markopy/ff82a054de47612f748fb6e388bf5588
# streamlit run visualisation/vis.py -- --animal cat

parser = argparse.ArgumentParser(description='This app lists animals')

parser.add_argument('--animal', action='append', default=[],
                    help="Add one or more animals of your choice")
sort_order_choices = ('up', 'down', 'random')
parser.add_argument('--sort', choices=sort_order_choices, default='up',
                    help='Animal sort order (default: %(default)s)')
parser.add_argument('--uppercase', action='store_true',
                    help='Make the animals bigger!')
parser.add_argument('--namespace', default="",help='namespace')
parser.add_argument('--logdir', default="",help='log dir')
parser.add_argument('--var1', default="default",help='var1')
parser.add_argument('--var2', default="default",help='var2')

try:
    args = parser.parse_args()
except SystemExit as e:
    # This exception will be raised if --help or invalid command line arguments
    # are used. Currently streamlit prevents the program from exiting normally
    # so we have to do a hard exit.
    # os._exit(e.code)
    pass


query_params = st.experimental_get_query_params()
param1 = query_params.get('param1', '1')
param2 = query_params.get('param2', '2')

st.write("""
# Title
query params:\n
param1 = {param1}\n
param2 = {param2}\n
cli params:\n
animals = {animals}\n
logDir = {logDir}\n
var1 = {var1}\n
""".format(param1=param1, param2=param2, animals=args.animal, logDir=args.logdir, var1=args.var1))

