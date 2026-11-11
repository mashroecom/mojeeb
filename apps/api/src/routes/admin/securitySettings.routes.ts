import { createSettingsCategoryRouter } from './settingsCategoryRouter';
import { SECURITY_DEFAULTS } from '../../services/systemSettings.service';

// Keys, seed defaults and accepted ranges live in systemSettings.service, next to the
// accessors that enforce them (password policy, session lifetime, login lockout).
export default createSettingsCategoryRouter({
  category: 'security',
  defs: SECURITY_DEFAULTS,
  auditAction: 'UPDATE_SECURITY_SETTINGS',
});
