import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { connect } from 'react-redux';
import type { RootState } from '../store';
import { setUser, removeUser, resetUser } from '../store/slices/UI';
import { selectUserId, selectUsers } from '../store/selectors';
import type { User } from '../types/entities';

type UserSelectorProps = {
  userId: string;
  users: User[] & { byId: (id: string) => User | undefined };
  doSetUser: (user: User) => void;
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
  onAdd
}: UserSelectorProps) {
  const { t } = useTranslation();

  const handleRemoveUser = useCallback(() => {
    const user = users.byId(userId);
    if (user && window.confirm(t('dialogs.confirmRemoveUser', { name: user.name }))) {
      doRemoveUser({ uuid: userId });
    }
  }, [userId, users, t, doRemoveUser]);

  const handleResetUser = useCallback(() => {
    const user = users.byId(userId);
    if (user && window.confirm(t('dialogs.confirmResetUser', { name: user.name }))) {
      doResetUser();
    }
  }, [userId, users, t, doResetUser]);

  return (
    <div className='flex w100'>
      {t('menu.user')}
      <select value={userId} onChange={e => {
        const value = e.target.value;
        if (value) {
          const user = users.byId(value);
          if (user) doSetUser(user);
        }
      }}>
        <option value="">{t('menu.notSelected')}</option>
        {users.map(user => (
          <option key={user.uuid} value={user.uuid}>
            {user.name} ({user.samples} {t('menu.samples')})
          </option>
        ))}
      </select>
      <button className='flex-grow m5' onClick={onAdd}>{t('menu.add')}</button>
      <button className='flex-grow m5' disabled={!userId} onClick={handleRemoveUser}>{t('menu.remove')}</button>
      <button className='flex-grow m5' disabled={!userId} onClick={handleResetUser}>{t('menu.reset')}</button>
    </div>
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
