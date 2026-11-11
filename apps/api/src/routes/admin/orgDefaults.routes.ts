import { createSettingsCategoryRouter } from './settingsCategoryRouter';
import { ORG_DEFAULTS } from '../../services/systemSettings.service';

// Keys, seed defaults and accepted ranges live in systemSettings.service; the enforced ones
// are applied when an organization is created (auth.service).
export default createSettingsCategoryRouter({
  category: 'org_defaults',
  defs: ORG_DEFAULTS,
  auditAction: 'UPDATE_ORG_DEFAULTS',
});
