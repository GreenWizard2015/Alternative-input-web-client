import { connect } from 'react-redux';
import type { RootState } from '../store';
import { setMonitor, removeMonitor, recreateMonitor } from '../store/slices/UI';
import { selectMonitorId, selectMonitors } from '../store/selectors';
import type { UUIDed } from '../shared/Sample';
import BaseSelector from './BaseSelector';

type MonitorSelectorProps = {
  monitorId: string;
  monitors: UUIDed[] & { byId: (id: string) => UUIDed | undefined };
  doSetMonitor: (name: string | null) => void;
  doRemoveMonitor: (payload: { uuid: string }) => void;
  doRecreateMonitor: (payload: { uuid: string }) => void;
  onAdd: () => void;
};

function MonitorSelector({
  monitorId,
  monitors,
  doSetMonitor,
  doRemoveMonitor,
  doRecreateMonitor,
  onAdd,
}: MonitorSelectorProps) {
  return (
    <BaseSelector<UUIDed>
      selectedId={monitorId}
      items={monitors}
      onSelect={(monitor) => doSetMonitor(monitor ? monitor.name : null)}
      onAdd={onAdd}
      onRemove={() => doRemoveMonitor({ uuid: monitorId })}
      onRecreate={() => doRecreateMonitor({ uuid: monitorId })}
      labelKey="menu.monitor"
      renderItemLabel={(monitor) => `${monitor.name}`}
      canRemove={(monitor) => monitor.name !== 'main'}
      confirmRemoveKey="dialogs.confirmRemoveMonitor"
      confirmRecreateKey="dialogs.confirmRecreateMonitor"
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
    doRecreateMonitor: recreateMonitor,
  }
)(MonitorSelector);
