import { type Component } from 'solid-js';
import CopyButton from './CopyButton.jsx';

const INSTALL_CMD = 'openclaw plugins install manifest';

const SetupStepInstall: Component<{ stepNumber?: number }> = (props) => {
  return (
    <div>
      <h3 class="setup-step__heading">
        {props.stepNumber ? `${props.stepNumber}. ` : ''}Install the Manifest plugin
      </h3>
      <p class="setup-step__desc">
        Install the Manifest plugin for OpenClaw to enable smart routing and observability.
      </p>

      <div class="modal-terminal">
        <div class="modal-terminal__header">
          <div class="modal-terminal__dots">
            <span class="modal-terminal__dot modal-terminal__dot--red" />
            <span class="modal-terminal__dot modal-terminal__dot--yellow" />
            <span class="modal-terminal__dot modal-terminal__dot--green" />
          </div>
          <div class="modal-terminal__tabs">
            <span class="modal-terminal__tab modal-terminal__tab--active">Terminal</span>
          </div>
        </div>
        <div class="modal-terminal__body">
          <CopyButton text={INSTALL_CMD} />
          <div>
            <span class="modal-terminal__prompt">$</span>
            <span class="modal-terminal__code">{INSTALL_CMD}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SetupStepInstall;
export { CopyButton };
