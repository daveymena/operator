/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║    Operator Pro — Campaign Templates & Bulk Operations          ║
 * ║    (Crear 50 campañas en 1 click)                               ║
 * ╚══════════════════════════════════════════════════════════════════╝
 * 
 * Features:
 * - Pre-built campaign templates for different industries
 * - Bulk campaign creation (1 click = 50 campaigns)
 * - Bulk pause/activate/delete
 * - Campaign cloning with variations
 * - Template customization
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { FacebookAdsSkill } from './facebook-ads.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GRAPH = 'https://graph.facebook.com/v21.0';

export class CampaignTemplates {
  constructor(opts = {}) {
    this.adAccountId = opts.adAccountId || process.env.FACEBOOK_AD_ACCOUNT || '';
    this.verbose = opts.verbose || false;
    this.adsSkill = new FacebookAdsSkill(opts);
    this.templates = this._loadDefaultTemplates();
  }

  _getToken() {
    try {
      const tokenFile = path.join(__dirname, '..', '..', 'facebook-automation', 'tokens', 'fb_tokens_output.json');
      return JSON.parse(fs.readFileSync(tokenFile, 'utf8')).accessToken;
    } catch {
      return process.env.FACEBOOK_ACCESS_TOKEN || '';
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  TEMPLATES
  // ═══════════════════════════════════════════════════════════════════

  _loadDefaultTemplates() {
    return {
      // E-commerce
      ecommerce_basic: {
        name: 'E-commerce Básico',
        industry: 'ecommerce',
        objective: 'OUTCOME_SALES',
        description: 'Campaña básica para tienda online',
        targeting: {
          geo_locations: { countries: ['CO'] },
          age_min: 22,
          age_max: 55,
          behaviors: [{ id: '6002714895172', name: 'Engaged Shoppers' }]
        },
        budget: { daily: 10000 },
        placements: ['facebook_feed', 'instagram_feed', 'instagram_stories']
      },

      ecommerce_retargeting: {
        name: 'Retargeting E-commerce',
        industry: 'ecommerce',
        objective: 'OUTCOME_SALES',
        description: 'Retargeting para visitantes del sitio web',
        targeting: {
          geo_locations: { countries: ['CO'] },
          age_min: 18,
          age_max: 65,
          custom_audiences: ['website_visitors_30d']
        },
        budget: { daily: 15000 },
        placements: ['facebook_feed', 'instagram_feed', 'facebook_right_column']
      },

      // Lead Generation
      lead_gen_basic: {
        name: 'Generación de Leads',
        industry: 'services',
        objective: 'OUTCOME_LEADS',
        description: 'Captura leads con formulario instantáneo',
        targeting: {
          geo_locations: { countries: ['CO'] },
          age_min: 25,
          age_max: 50,
          interests: [{ id: '6003070867373', name: 'Digital marketing' }]
        },
        budget: { daily: 8000 },
        placements: ['facebook_feed', 'instagram_feed']
      },

      // Education / Courses
      education_course: {
        name: 'Venta de Cursos',
        industry: 'education',
        objective: 'OUTCOME_LEADS',
        description: 'Promoción de cursos online',
        targeting: {
          geo_locations: { countries: ['CO'] },
          age_min: 20,
          age_max: 45,
          interests: [
            { id: '6003172932634', name: 'Online learning' },
            { id: '6003276909572', name: 'Professional development' }
          ]
        },
        budget: { daily: 12000 },
        placements: ['facebook_feed', 'instagram_feed', 'instagram_stories']
      },

      // Local Business
      local_awareness: {
        name: 'Negocio Local - Reconocimiento',
        industry: 'local',
        objective: 'OUTCOME_AWARENESS',
        description: 'Dar a conocer negocio local',
        targeting: {
          geo_locations: {
            cities: [{ key: 2345896, radius: 15, distance_unit: 'kilometer' }]
          },
          age_min: 18,
          age_max: 65
        },
        budget: { daily: 5000 },
        placements: ['facebook_feed', 'instagram_feed']
      },

      // App Install
      app_install: {
        name: 'Instalación de App',
        industry: 'mobile',
        objective: 'OUTCOME_APP_PROMOTION',
        description: 'Promover instalación de aplicación móvil',
        targeting: {
          geo_locations: { countries: ['CO'] },
          age_min: 18,
          age_max: 45,
          user_device: ['Smartphones'],
          user_os: ['Android', 'iOS']
        },
        budget: { daily: 20000 },
        placements: ['facebook_feed', 'instagram_feed', 'instagram_stories', 'facebook_stories']
      },

      // Traffic
      traffic_blog: {
        name: 'Tráfico a Blog',
        industry: 'content',
        objective: 'OUTCOME_TRAFFIC',
        description: 'Llevar tráfico a artículos del blog',
        targeting: {
          geo_locations: { countries: ['CO'] },
          age_min: 22,
          age_max: 55
        },
        budget: { daily: 5000 },
        placements: ['facebook_feed', 'instagram_feed']
      }
    };
  }

  /**
   * Get all available templates
   */
  getTemplates() {
    return Object.entries(this.templates).map(([key, template]) => ({
      key,
      ...template
    }));
  }

  /**
   * Get a specific template
   */
  getTemplate(key) {
    return this.templates[key] || null;
  }

  /**
   * Create a custom template
   */
  addTemplate(key, template) {
    this.templates[key] = template;
    return { ok: true, key };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  BULK CREATION
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Create multiple campaigns from a template with variations
   */
  async bulkCreateFromTemplate(templateKey, variations) {
    const template = this.getTemplate(templateKey);
    if (!template) return { ok: false, error: 'Template not found' };

    const token = this._getToken();
    if (!token) return { ok: false, error: 'No access token' };

    const results = [];
    let successCount = 0;
    let failCount = 0;

    for (const variation of variations) {
      const campaignConfig = {
        ...template,
        name: variation.name || `${template.name} - ${variation.suffix || Date.now()}`,
        targeting: { ...template.targeting, ...variation.targeting },
        budget: variation.budget || template.budget
      };

      try {
        const result = await this._createCampaignViaAPI(campaignConfig, token);
        if (result.ok) {
          successCount++;
          results.push({ variation: variation.name, ...result });
        } else {
          failCount++;
          results.push({ variation: variation.name, ok: false, error: result.error });
        }
      } catch (e) {
        failCount++;
        results.push({ variation: variation.name, ok: false, error: e.message });
      }

      // Rate limiting: wait 500ms between requests
      await this._sleep(500);
    }

    return {
      ok: true,
      total: variations.length,
      success: successCount,
      failed: failCount,
      results
    };
  }

  /**
   * Create A/B test variations automatically
   */
  async createABTest(baseConfig, variations) {
    const abVariations = variations.map((v, i) => ({
      name: `${baseConfig.name} - Variation ${String.fromCharCode(65 + i)}`,
      ...v
    }));

    return await this.bulkCreateFromTemplate('custom', abVariations);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  BULK OPERATIONS
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Bulk update campaign status (pause/activate/delete)
   */
  async bulkUpdateStatus(campaignIds, status) {
    const token = this._getToken();
    if (!token) return { ok: false, error: 'No access token' };

    const results = [];
    let successCount = 0;

    for (const campaignId of campaignIds) {
      try {
        const url = `${GRAPH}/${campaignId}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ status, access_token: token })
        });
        const data = await res.json();
        
        if (data.success) {
          successCount++;
          results.push({ campaignId, ok: true });
        } else {
          results.push({ campaignId, ok: false, error: JSON.stringify(data) });
        }
      } catch (e) {
        results.push({ campaignId, ok: false, error: e.message });
      }

      await this._sleep(300);
    }

    return {
      ok: true,
      total: campaignIds.length,
      success: successCount,
      failed: campaignIds.length - successCount,
      results
    };
  }

  /**
   * Bulk update budgets
   */
  async bulkUpdateBudget(campaignBudgets) {
    const token = this._getToken();
    if (!token) return { ok: false, error: 'No access token' };

    const results = [];
    let successCount = 0;

    for (const { campaignId, budget } of campaignBudgets) {
      try {
        const url = `${GRAPH}/${campaignId}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            daily_budget: String(Math.round(budget * 100)),
            access_token: token
          })
        });
        const data = await res.json();
        
        if (data.success) {
          successCount++;
          results.push({ campaignId, budget, ok: true });
        } else {
          results.push({ campaignId, budget, ok: false, error: JSON.stringify(data) });
        }
      } catch (e) {
        results.push({ campaignId, budget, ok: false, error: e.message });
      }

      await this._sleep(300);
    }

    return {
      ok: true,
      total: campaignBudgets.length,
      success: successCount,
      failed: campaignBudgets.length - successCount,
      results
    };
  }

  /**
   * Clone a campaign with variations
   */
  async cloneCampaign(sourceCampaignId, variations) {
    const token = this._getToken();
    if (!token) return { ok: false, error: 'No access token' };

    // Fetch source campaign
    try {
      const url = `${GRAPH}/${sourceCampaignId}?fields=name,objective,daily_budget,status,special_ad_categories&access_token=${token}`;
      const res = await fetch(url);
      const source = await res.json();

      if (!source.id) return { ok: false, error: 'Campaign not found' };

      const cloned = [];
      for (let i = 0; i < variations; i++) {
        const newConfig = {
          name: `${source.name} - Clone ${i + 1}`,
          objective: source.objective,
          status: 'PAUSED',
          daily_budget: source.daily_budget ? parseInt(source.daily_budget) / 100 : 5000,
          special_ad_categories: source.special_ad_categories || []
        };

        const result = await this._createCampaignViaAPI(newConfig, token);
        cloned.push(result);
        await this._sleep(500);
      }

      return {
        ok: true,
        source: sourceCampaignId,
        clones: cloned.filter(c => c.ok).length,
        results: cloned
      };

    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  INTERNAL
  // ═══════════════════════════════════════════════════════════════════

  async _createCampaignViaAPI(config, token) {
    try {
      const url = `${GRAPH}/act_${this.adAccountId}/campaigns`;
      const body = new URLSearchParams({
        name: config.name,
        objective: config.objective,
        status: config.status || 'PAUSED',
        daily_budget: String(Math.round((config.budget?.daily || 5000) * 100)),
        special_ad_categories: JSON.stringify(config.special_ad_categories || []),
        access_token: token
      });

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body
      });

      const data = await res.json();
      if (data.id) {
        return { ok: true, campaignId: data.id, name: config.name };
      }
      return { ok: false, error: JSON.stringify(data) };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default CampaignTemplates;
