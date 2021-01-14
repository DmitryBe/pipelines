/*
 * Copyright 2018 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as React from 'react';
import BusyButton from '../../atoms/BusyButton';
import Button from '@material-ui/core/Button';
import Viewer, { ViewerConfig } from './Viewer';
import { Apis } from '../../lib/Apis';
import { commonCss, padding, color } from '../../Css';
import InputLabel from '@material-ui/core/InputLabel';
import Input from '@material-ui/core/Input';
import FormHelperText from '@material-ui/core/FormHelperText';
import FormControl from '@material-ui/core/FormControl';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';
import DialogTitle from '@material-ui/core/DialogTitle';
import { classes, stylesheet } from 'typestyle';
import { logger } from '../../lib/Utils';

export const css = stylesheet({
  button: {
    marginBottom: 20,
    width: 150,
  },
  formControl: {
    minWidth: 120,
  },
  select: {
    minHeight: 50,
    width:500,
  },
  shortButton: {
    width: 50,
  },
  warningText: {
    color: color.warningText,
  },
  errorText: {
    color: color.errorText,
  },
});

export interface FlexyVisViewerConfig extends ViewerConfig {
  source: string;
  entryPoint: string;
  namespace: string;
  params: Map<string, string>;
}

interface FlexyVisViewerProps {
  configs: FlexyVisViewerConfig[];
  // Interval in ms. If not specified, default to 5000.
  intervalOfCheckingTensorboardPodStatus?: number;
}

interface FlexyVisViewerState {
  busy: boolean;
  deleteDialogOpen: boolean;
  podAddress: string;
  // When podAddress is not null, we need to further tell whether the TensorBoard pod is accessible or not
  visReady: boolean;
  errorMessage?: string;
  
  source: string;
  entryPoint: string;
  namespace: string;
  paramsUrlStr: string;
}

// TODO: move to config
const BASE_DOMAIN = "http://ambassador.ingress.dev.grabds.com"

class FlexyVisViewer extends Viewer<FlexyVisViewerProps, FlexyVisViewerState> {
  timerID: NodeJS.Timeout;

  constructor(props: any) {
    super(props);

    let firstConfig = this.props.configs[0];
    let paramsUrlStr = Array.from(firstConfig.params).sort().map(x => `${x[0]}=${encodeURIComponent(x[1])}`).join("&")

    this.state = {
      busy: false,
      deleteDialogOpen: false,
      podAddress: '',
      visReady: false,
      errorMessage: undefined,

      source: firstConfig.source,
      entryPoint: firstConfig.entryPoint,
      namespace: firstConfig.namespace,
      paramsUrlStr: paramsUrlStr, 
    };
  }

  public getDisplayName(): string {
    return 'FlexyVis';
  }

  public isAggregatable(): boolean {
    return true;
  }

  public componentDidMount(): void {
    this._checkFlexyVisApp();
    this.timerID = setInterval(
      () => this._checkFlexVisPodStatus(),
      this.props.intervalOfCheckingTensorboardPodStatus || 5000,
    );
  }

  public componentWillUnmount(): void {
    clearInterval(this.timerID);
  }

  public handleParamsUpdate = (e: React.ChangeEvent<{ name?: string; value: unknown }>): void => {    
    if (typeof e.target.value !== 'string') {
      throw new Error('Invalid event value type, expected string');
    }
    logger.verbose(`paramsUrlStr: ${e.target.value}`)
    this.setState({ paramsUrlStr: e.target.value });
  };

  public render(): JSX.Element {
    return (
      <div>
        {this.state.errorMessage && <div className={css.errorText}>{this.state.errorMessage}</div>}
        {this.state.podAddress && (
          <div>
            <a
              href={makeProxyUrl(this.state.podAddress)}
              target='_blank'
              rel='noopener noreferrer'
              className={commonCss.unstyled}
            >
              <Button
                className={classes(commonCss.buttonAction, css.button)}
                disabled={this.state.busy}
                color={'primary'}
              >
                Open Visualisation
              </Button>
              {this.state.visReady ? (
                ``
              ) : (
                <div className={css.warningText}>
                  [doesn't work yet] Visualisation is starting, and you may need to wait for a few minutes.
                </div>
              )}
            </a>

            <div>
              <Button
                className={css.button}
                disabled={this.state.busy}
                id={'delete'}
                title={`stop visualisation and delete its instance`}
                onClick={this._handleDeleteOpen}
                color={'default'}
              >
                Delete Visualisation
              </Button>
              <Dialog
                open={this.state.deleteDialogOpen}
                onClose={this._handleDeleteClose}
                aria-labelledby='dialog-title'
              >
                <DialogTitle id='dialog-title'>
                  {`Stop Visualisation?`}
                </DialogTitle>
                <DialogContent>
                  <DialogContentText>
                    You can stop the current running tensorboard. The tensorboard viewer will also
                    be deleted from your workloads.
                  </DialogContentText>
                </DialogContent>
                <DialogActions>
                  <Button
                    className={css.shortButton}
                    id={'cancel'}
                    autoFocus={true}
                    onClick={this._handleDeleteClose}
                    color='primary'
                  >
                    Cancel
                  </Button>
                  <BusyButton
                    className={classes(commonCss.buttonAction, css.shortButton)}
                    onClick={this._deleteFlexVis}
                    busy={this.state.busy}
                    color='primary'
                    title={`Stop`}
                  />
                </DialogActions>
              </Dialog>
            </div>
          </div>
        )}

        {!this.state.podAddress && (
          <div>
            <div className={padding(30, 'b')}>
              <FormControl className={css.formControl} >
                {/* <InputLabel >Source</InputLabel> */}
                <Input 
                  id="config-source" 
                  className={css.select}
                  readOnly={true}
                  // onChange={this.handleParamsUpdate}
                  defaultValue={this.state.source} />
                {/* <InputLabel htmlFor='config-entry-point'>Entry point</InputLabel> */}
                <Input 
                  id="config-entry-point" 
                  className={css.select}
                  readOnly={true}
                  // onChange={this.handleParamsUpdate}
                  defaultValue={this.state.entryPoint} />
                {/* <InputLabel htmlFor='config-params'>Params</InputLabel> */}
                <Input 
                  id="config-params" 
                  className={css.select}
                  readOnly={true}
                  onChange={this.handleParamsUpdate}
                  defaultValue={this.state.paramsUrlStr} />
              </FormControl>
            </div>
            <div>
              <BusyButton
                className={commonCss.buttonAction}
                onClick={this._startFlexVis}
                busy={this.state.busy}
                title={`Start ${this.props.configs.length > 1 ? 'Combined ' : ''}Visualisation`}
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  private _handleDeleteOpen = () => {
    this.setState({ deleteDialogOpen: true });
  };

  private _handleDeleteClose = () => {
    this.setState({ deleteDialogOpen: false });
  };

  private _buildUrlParams(): string {
    return `source=${encodeURIComponent(this.state.source)}&entrypoint=${encodeURIComponent(this.state.entryPoint)}&namespace=${encodeURIComponent(this.state.namespace)}&${this.state.paramsUrlStr}`
  }

  private async _checkFlexVisPodStatus(): Promise<void> {
    // If pod address is not null and tensorboard pod doesn't seem to be read, pull status again

    if (this.state.podAddress && !this.state.visReady) {
      // Remove protocol prefix bofore ":" from pod address if any.

      // var url = makeProxyUrl(this.state.podAddress)
      // logger.verbose(`checking url: ${url}`)
      
      // Apis.isFlexyVisPodReady(makeProxyUrl(this.state.podAddress)).then(ready => {
      //   logger.verbose(ready)
      //   this.setState(({ visReady: tensorboardReady }) => ({ visReady: tensorboardReady || ready }));
      // });
    }
  }

  private async _checkFlexyVisApp(): Promise<void> {
    this.setState({ busy: true }, async () => {
      try {
        let urlParams = this._buildUrlParams()
        logger.verbose(urlParams)

        const { podAddress, } = await Apis.getFlexyVisApp(
          this._buildUrlParams(),
        );
        if (podAddress) {
          this.setState({ busy: false, podAddress });
        } else {
          // No existing pod
          this.setState({ busy: false });
        }
        logger.verbose(this.state)
      } catch (err) {
        this.setState({ busy: false, errorMessage: err?.message || 'Unknown error' });
      }
    });
  }

  private _startFlexVis = async () => {
    logger.verbose('starting visualisation')
    this.setState({ busy: true, errorMessage: undefined }, async () => {
      try { 
        await Apis.startFlexyVisApp(
          this._buildUrlParams()
        );
        this.setState({ busy: false, visReady: false }, () => {
          this._checkFlexyVisApp();
        });
      } catch (err) {
        this.setState({ busy: false, errorMessage: err?.message || 'Unknown error' });
      }
    });
  };

  private _deleteFlexVis = async () => {
    // delete the already opened Tensorboard, clear the podAddress recorded in frontend,
    // and return to the select & start tensorboard page
    this.setState({ busy: true, errorMessage: undefined }, async () => {
      try {
        await Apis.deleteFlexyVisApp(this._buildUrlParams());
        this.setState({
          busy: false,
          deleteDialogOpen: false,
          podAddress: '',
          visReady: false,
        });
      } catch (err) {
        this.setState({ busy: false, errorMessage: err?.message || 'Unknown error' });
      }
    });
  };
}

function makeProxyUrl(podAddress: string) {
  // Strip the protocol from the URL. This is a workaround for cloud shell
  // incorrectly decoding the address and replacing the protocol's // with /.
  // Pod address (after stripping protocol) is of the format
  // <viewer_service_dns>.kubeflow.svc.cluster.local:6006/tensorboard/<viewer_name>/
  // We use this pod address without encoding since encoded pod address failed to open the
  // tensorboard instance on this pod.
  // TODO: figure out why the encoded pod address failed to open the tensorboard.
  
  // return 'apis/v1beta1/_proxy/' + podAddress.replace(/(^\w+:|^)\/\//, '');
  let matchRes = podAddress.match("/flexy-vis\/.+\/")
  var svcPref
  if (matchRes != null) {
    svcPref = matchRes[0]
  } else {
    throw new Error('Invalid podAddress format');
  }
  return `${BASE_DOMAIN}${svcPref}`
}

export default FlexyVisViewer;
