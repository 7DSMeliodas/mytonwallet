import React, { memo } from '../../lib/teact/teact';

import { APP_NAME, APP_VERSION } from '../../config';
import renderText from '../../global/helpers/renderText';
import buildClassName from '../../util/buildClassName';
import { IS_EXTENSION } from '../../util/windowEnvironment';

import useLang from '../../hooks/useLang';

import Button from '../ui/Button';
import Emoji from '../ui/Emoji';
import ModalHeader from '../ui/ModalHeader';

import styles from './Settings.module.scss';

import logoSrc from '../../assets/logo.svg';

interface OwnProps {
  handleBackClick: () => void;
  isInsideModal?: boolean;
}

function SettingsAbout({ handleBackClick, isInsideModal }: OwnProps) {
  const lang = useLang();

  return (
    <div className={buildClassName(styles.slide, 'custom-scroll')}>
      {isInsideModal ? (
        <ModalHeader title={lang('About')} onBackButtonClick={handleBackClick} />
      ) : (
        <div className={styles.header}>
          <Button isSimple isText onClick={handleBackClick} className={styles.headerBack}>
            <i className={buildClassName(styles.iconChevron, 'icon-chevron-left')} aria-hidden />
            <span>{lang('Back')}</span>
          </Button>
          <span className={styles.headerTitle}>{lang('About')}</span>
        </div>
      )}
      <div className={styles.content}>
        <img src={logoSrc} alt={lang('Logo')} className={styles.logo} />
        <h2 className={styles.title}>
          {APP_NAME} {APP_VERSION}
          <a href="https://mytonwallet.io/" target="_blank" className={styles.titleLink} rel="noreferrer">
            mytonwallet.io
          </a>
        </h2>
        <div className={styles.blockAbout}>
          <p className={styles.text}>
            {renderText(lang('$about_description1'))}
          </p>
          <p className={styles.text}>
            {renderText(lang('$about_description2'))}
          </p>
          {IS_EXTENSION ? (
            <>
              <h3 className={buildClassName(styles.text, styles.heading)}>
                <Emoji from="🥷" /> {lang('What is TON Proxy?')}
              </h3>
              <p className={styles.text}>
                {renderText(lang('$about_extension_description1'))}{' '}
                <a
                  href="https://telegra.ph/TON-Sites-TON-WWW-and-TON-Proxy-09-29-2"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {lang('More info and demo.')}
                </a>
              </p>
              <h3 className={buildClassName(styles.text, styles.heading)}>
                <Emoji from="🦄" /> {lang('What is TON Magic?')}
              </h3>
              <p className={styles.text}>
                {renderText(lang('$about_extension_description2'))}
              </p>
              <p className={styles.text}>
                {lang('$about_extension_description3')}{' '}
                <a href="https://telegra.ph/Telegram--TON-11-10" target="_blank" rel="noopener noreferrer">
                  {lang('More info and demo.')}
                </a>
              </p>
            </>
          ) : (
            <>
              <h3 className={buildClassName(styles.text, styles.heading)}>
                {lang('$about_proxy_magic_title', { ninja: <Emoji from="🥷" />, unicorn: <Emoji from="🦄" /> })}
              </h3>
              <p className={styles.text}>
                {lang('$about_proxy_magic_description', {
                  extension_link: (
                    <a href="https://mytonwallet.io/" target="_blank" rel="noreferrer">
                      {renderText(lang('$about_extension_link_text'))}
                    </a>
                  ),
                })}
              </p>
            </>
          )}
          <h3 className={buildClassName(styles.text, styles.heading)}>
            <i className={buildClassName(styles.github, 'icon-github')} /> {lang('Is it open source?')}
          </h3>
          <p className={styles.text}>
            {lang('$about_wallet_github', {
              github_link: (
                <a href="https://github.com/mytonwalletorg/mytonwallet" target="_blank" rel="noreferrer">
                  {renderText(lang('$about_github_link_text'))}
                </a>
              ),
            })}
          </p>
          <h3 className={styles.heading}>
            <i className={buildClassName(styles.telegram, 'icon-telegram')} /> {lang('Is there a community?')}
          </h3>
          <p className={styles.text}>
            {lang('$about_wallet_community', {
              community_link: (
                <a
                  href={lang.code === 'ru' ? 'https://t.me/MyTonWalletRu' : 'https://t.me/MyTonWalletEn'}
                  target="_blank"
                  rel="noreferrer"
                >
                  {renderText(lang('$about_community_link_text'))}
                </a>
              ),
            })}
          </p>
        </div>
      </div>
    </div>
  );
}

export default memo(SettingsAbout);
