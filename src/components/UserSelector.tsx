import { connect } from 'react-redux';
import type { RootState } from '../store';
import { setUser, removeUser, resetUser } from '../store/slices/UI';
import { selectUserId, selectUsers } from '../store/selectors';
import type { User } from '../types/entities';
import BaseSelector from './BaseSelector';

type UserSelectorProps = {
  userId: string;
  users: User[] & { byId: (id: string) => User | undefined };
  doSetUser: (name: string | null) => void;
  doRemoveUser: (payload: { uuid: string }) => void;
  doResetUser: () => void;
  onAdd: () => void;
};

function UserSelector({
  userId,
  users,
  doSetUser,
  doRemoveUser,
  doResetUser,
  onAdd,
}: UserSelectorProps) {
  return (
    <BaseSelector<User>
      selectedId={userId}
      items={users}
      onSelect={(user) => doSetUser(user ? user.name : null)}
      onAdd={onAdd}
      onRemove={() => doRemoveUser({ uuid: userId })}
      onReset={doResetUser}
      labelKey="menu.user"
      renderItemLabel={(user) => `${user.name} (${user.samples} samples)`}
      confirmRemoveKey="dialogs.confirmRemoveUser"
      confirmResetKey="dialogs.confirmResetUser"
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
    doResetUser: resetUser,
  }
)(UserSelector);
