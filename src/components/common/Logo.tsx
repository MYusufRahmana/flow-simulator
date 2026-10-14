import logoFull from '../../assets/logo-full.png';
import logoMark from '../../assets/logo-mark.png';

/** Flow gradient-ribbon logo. `mark` = the ribbon alone (square), `full` = ribbon + "Flow" wordmark. */
export default function Logo({ size = 32, variant = 'mark' }: { size?: number; variant?: 'mark' | 'full' }) {
  if (variant === 'full') {
    return <img src={logoFull} alt="Flow" height={size} style={{ height: size, width: 'auto' }} draggable={false} />;
  }
  return <img src={logoMark} alt="" aria-hidden width={size} height={size} style={{ width: size, height: size }} draggable={false} />;
}
