import React, { memo, useEffect } from '../../../../lib/teact/teact';

import { ElectronEvent } from '../../../../electron/types';

import { TON_TOKEN_SLUG } from '../../../../config';
import { getActions } from '../../../../global';
import buildClassName from '../../../../util/buildClassName';

import useFlag from '../../../../hooks/useFlag';
import useLang from '../../../../hooks/useLang';

import ReceiveModal from '../../../receive/ReceiveModal';
import Button from '../../../ui/Button';

import styles from './PortraitActions.module.scss';

interface OwnProps {
  hasStaking?: boolean;
  isUnstakeRequested?: boolean;
  onEarnClick: NoneToVoidFunction;
}

function PortraitActions({ hasStaking, isUnstakeRequested, onEarnClick }: OwnProps) {
  const { startTransfer } = getActions();

  const lang = useLang();
  const [isReceiveTonOpened, openReceiveTon, closeReceiveTon] = useFlag(false);

  useEffect(() => {
    return window.electron?.on(ElectronEvent.DEEPLINK, (params: any) => {
      startTransfer({
        tokenSlug: TON_TOKEN_SLUG,
        toAddress: params.to,
        amount: params.amount,
        comment: params.text,
      });
    });
  }, [startTransfer]);

  return (
    <div className={styles.container}>
      <div className={styles.buttons}>
        <Button className={styles.button} onClick={openReceiveTon} isSimple>
          <i className={buildClassName(styles.buttonIcon, 'icon-receive')} aria-hidden />
          {lang('Receive')}
        </Button>
        <Button className={styles.button} onClick={startTransfer} isSimple>
          <i className={buildClassName(styles.buttonIcon, 'icon-send')} aria-hidden />
          {lang('Send')}
        </Button>
        <Button
          className={buildClassName(styles.button, hasStaking && styles.button_purple)}
          onClick={onEarnClick}
          isSimple
        >
          <i className={buildClassName(styles.buttonIcon, 'icon-earn')} aria-hidden />
          {lang(isUnstakeRequested ? 'Unstaking' : hasStaking ? 'Earning' : 'Earn')}
        </Button>
      </div>
      <ReceiveModal isOpen={isReceiveTonOpened} onClose={closeReceiveTon} />
    </div>
  );
}

export default memo(PortraitActions);
