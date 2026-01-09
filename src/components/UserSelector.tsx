import { connect } from 'react-redux';
import type { RootState } from '../store';
import { setUser, removeUser, recreateUser } from '../store/slices/UI';
import { selectUserId, selectUsers } from '../store/selectors';
import type { User } from '../types/entities';
import BaseSelector from './BaseSelector';

type UserSelectorProps = {
  userId: string;
  users: User[] & { byId: (id: string) => User | undefined };
  doSetUser: (name: string | null) => void;
  doRemoveUser: (payload: { uuid: string }) => void;
  doRecreateUser: () => void;
  onAdd: () => void;
};

function UserSelector({
  userId,
  users,
  doSetUser,
  doRemoveUser,
  doRecreateUser,
  onAdd,
}: UserSelectorProps) {
  return (
    <BaseSelector<User>
      selectedId={userId}
      items={users}
      onSelect={(user) => doSetUser(user ? user.name : null)}
      onAdd={onAdd}
      onRemove={() => doRemoveUser({ uuid: userId })}
      onRecreate={doRecreateUser}
      labelKey="menu.user"
      renderItemLabel={(user) => `${user.name} (${user.samples} samples)`}
      confirmRemoveKey="dialogs.confirmRemoveUser"
      confirmRecreateKey="dialogs.confirmRecreateUser"
    />
  );
}

export default connect(
  (state: RootState) => ({
    userId: selectUserId(state),
    users: selectUsers(state),
  }),
  {
    doSetUser: setUser,
    doRemoveUser: removeUser,
    doRecreateUser: recreateUser,
  }
)(UserSelector);
