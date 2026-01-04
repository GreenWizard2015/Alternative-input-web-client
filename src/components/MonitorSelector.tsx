import { connect } from 'react-redux';
import type { RootState } from '../store';
import { setMonitor, removeMonitor, resetMonitor } from '../store/slices/UI';
import { selectMonitorId, selectMonitors } from '../store/selectors';
import type { UUIDed } from '../shared/Sample';
import BaseSelector from './BaseSelector';

type MonitorSelectorProps = {
  monitorId: string;
  monitors: UUIDed[] & { byId: (id: string) => UUIDed | undefined };
  doSetMonitor: (monitor: UUIDed) => void;
  doRemoveMonitor: (payload: { uuid: string }) => void;
  doResetMonitor: (payload: { uuid: string }) => void;
  onAdd: () => void;
};

function MonitorSelector({
  monitorId,
  monitors,
  doSetMonitor,
  doRemoveMonitor,
  doResetMonitor,
  onAdd,
}: MonitorSelectorProps) {
  return (
    <BaseSelector<UUIDed>
      selectedId={monitorId}
      items={monitors}
      onSelect={doSetMonitor}
      onAdd={onAdd}
      onRemove={() => doRemoveMonitor({ uuid: monitorId })}
      onReset={() => doResetMonitor({ uuid: monitorId })}
      labelKey="menu.monitor"
      renderItemLabel={(monitor) => `${monitor.name}`}
      canRemove={(monitor) => monitor.name !== 'main'}
      confirmRemoveKey="dialogs.confirmRemoveMonitor"
      confirmResetKey="dialogs.confirmResetMonitor"
    />
  );
}

export default connect(
  (state: RootState) => ({
    monitorId: selectMonitorId(state),
    monitors: selectMonitors(state),
  }),
  {
    doSetMonitor: setMonitor,
    doRemoveMonitor: removeMonitor,
    doResetMonitor: resetMonitor,
  }
)(MonitorSelector);
