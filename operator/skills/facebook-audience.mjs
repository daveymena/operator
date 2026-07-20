/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║    Operator Pro — Facebook Audience Segmentation Skill          ║
 * ║    (Como ChatGPT Operator 6:50 — Segmentar audiencias)          ║
 * ╚══════════════════════════════════════════════════════════════════╝
 * 
 * Capabilities:
 * - Configure geographic targeting (countries, cities, radius)
 * - Set age and gender targeting
 * - Add detailed interests and behaviors
 * - Create custom audiences
 * - Create lookalike audiences
 * - Both UI (Ads Manager) and API modes
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getBrowser } from '../engines/browser.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GRAPH = 'https://graph.facebook.com/v21.0';

export class FacebookAudienceBuilder {
  constructor(opts = {}) {
    this.adAccountId = opts.adAccountId || process.env.FACEBOOK_AD_ACCOUNT || '';
    this.verbose = opts.verbose || false;
    this.browser = getBrowser(opts);
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
  //  API: Build targeting object for Meta Ads API
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Build a complete targeting spec for the Ads API
   */
  buildTargeting(config) {
    const {
      // Location
      countries = ['CO'],
      cities = [],
      regions = [],
      radiusKm = null,
      locationTypes = 'home', // home, recent, travel

      // Demographics
      ageMin = 18,
      ageMax = 65,
      genders = [], // [] = all, [1] = male, [2] = female

      // Interests
      interests = [],        // [{id, name}]
      behaviors = [],        // [{id, name}]
      demographics = [],     // [{id, name}]

      // Connections
      connections = [],      // pages, apps, events

      // Placements
      platforms = ['facebook', 'instagram'],
      facebookPositions = ['feed', 'story', 'reels', 'right_hand_column', 'marketplace'],
      instagramPositions = ['stream', 'story', 'reels', 'explore'],

      // Languages
      languages = [],

      // Exclusions
      excludeInterests = [],
      excludeCustomAudiences = [],

      // Custom/Lookalike
      customAudiences = [],
      lookalikeAudiences = [],

      // Optimization
      optimizationGoal = 'LINK_CLICKS',
      billingEvent = 'IMPRESSIONS'
    } = config;

    const targeting = {
      geo_locations: {},
      age_min: ageMin,
      age_max: ageMax,
      publisher_platforms: platforms,
      facebook_positions: facebookPositions,
      instagram_positions: instagramPositions
    };

    // Geographic targeting
    if (countries.length > 0) targeting.geo_locations.countries = countries;
    if (cities.length > 0) {
      targeting.geo_locations.cities = cities.map(c => ({
        key: c.key || c.id,
        radius: c.radius || radiusKm || 25,
        distance_unit: 'kilometer'
      }));
    }
    if (regions.length > 0) {
      targeting.geo_locations.regions = regions.map(r => ({ key: r.key || r.id }));
    }

    // Gender
    if (genders.length > 0) targeting.genders = genders;

    // Languages
    if (languages.length > 0) targeting.locales = languages;

    // Interests, behaviors, demographics (flexible_spec)
    const flexSpec = [];
    if (interests.length > 0) {
      flexSpec.push({ interests: interests.map(i => ({ id: i.id, name: i.name })) });
    }
    if (behaviors.length > 0) {
      flexSpec.push({ behaviors: behaviors.map(b => ({ id: b.id, name: b.name })) });
    }
    if (demographics.length > 0) {
      flexSpec.push({ demographics: demographics.map(d => ({ id: d.id, name: d.name })) });
    }
    if (flexSpec.length > 0) targeting.flexible_spec = flexSpec;

    // Exclusions
    if (excludeInterests.length > 0) {
      targeting.exclusions = {
        interests: excludeInterests.map(i => ({ id: i.id, name: i.name }))
      };
    }

    // Custom/Lookalike audiences
    if (customAudiences.length > 0) {
      targeting.custom_audiences = customAudiences.map(a => ({ id: a.id, name: a.name }));
    }
    if (lookalikeAudiences.length > 0) {
      targeting.custom_audiences = [
        ...(targeting.custom_audiences || []),
        ...lookalikeAudiences.map(a => ({ id: a.id, name: a.name }))
      ];
    }

    return { targeting, optimizationGoal, billingEvent };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  API: Search for interests, behaviors, demographics
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Search for targeting options (interests, behaviors, etc.)
   */
  async searchTargeting(query, type = 'interest', opts = {}) {
    const token = this._getToken();
    if (!token) return { ok: false, error: 'No access token' };

    const typeMap = {
      interest: 'interest',
      behavior: 'behaviors',
      demographic: 'demographics',
      education: 'education_majors',
      employer: 'employers',
      family: 'family_statuses',
      politics: 'politics'
    };

    try {
      const url = `${GRAPH}/act_${this.adAccountId}/targetingsearch?` + new URLSearchParams({
        q: query,
        type: typeMap[type] || type,
        limit: String(opts.limit || 20),
        access_token: token
      });

      const res = await fetch(url);
      const data = await res.json();

      if (!data.data) return { ok: false, error: JSON.stringify(data) };

      return {
        ok: true,
        results: data.data.map(r => ({
          id: r.id,
          name: r.name,
          audience_size: r.audience_size,
          path: r.path?.join(' > ') || '',
          type: r.type
        })),
        count: data.data.length
      };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  /**
   * Get estimated audience size for targeting config
   */
  async estimateAudience(targetingConfig) {
    const token = this._getToken();
    if (!token) return { ok: false, error: 'No access token' };

    const { targeting } = this.buildTargeting(targetingConfig);

    try {
      const url = `${GRAPH}/act_${this.adAccountId}/reachestimate?` + new URLSearchParams({
        targeting_spec: JSON.stringify(targeting),
        access_token: token
      });

      const res = await fetch(url);
      const data = await res.json();

      if (data.data) {
        return {
          ok: true,
          dailyOutreach: data.data.estimate_ready ? data.data.users : null,
          lowerBound: data.data.estimate_ready ? data.data.lower_bound : null,
          upperBound: data.data.estimate_ready ? data.data.upper_bound : null,
          ready: data.data.estimate_ready
        };
      }
      return { ok: false, error: JSON.stringify(data) };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  PRESET AUDIENCES: Common targeting configurations
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Pre-built audience presets for common scenarios
   */
  static getPresets() {
    return {
      // Colombia general
      colombia_general: {
        name: 'Colombia General',
        countries: ['CO'],
        ageMin: 18,
        ageMax: 65,
        platforms: ['facebook', 'instagram']
      },

      // Colombian cities
      colombia_ciudades: {
        name: 'Principales Ciudades Colombia',
        countries: ['CO'],
        cities: [
          { key: 2345896, name: 'Bogotá', radius: 40 },
          { key: 2345897, name: 'Medellín', radius: 30 },
          { key: 2345898, name: 'Cali', radius: 30 },
          { key: 2345899, name: 'Barranquilla', radius: 25 },
          { key: 2345900, name: 'Cartagena', radius: 25 }
        ],
        ageMin: 20,
        ageMax: 55
      },

      // Tech / Digital
      tech_colombia: {
        name: 'Tech Colombia',
        countries: ['CO'],
        ageMin: 22,
        ageMax: 45,
        interests: [
          { id: '6003003210176', name: 'Technology' },
          { id: '6003070867373', name: 'Digital marketing' },
          { id: '6003472972473', name: 'Software' },
          { id: '6003139329654', name: 'Artificial intelligence' }
        ],
        platforms: ['facebook', 'instagram']
      },

      // E-commerce shoppers
      shoppers_colombia: {
        name: 'Compradores Online Colombia',
        countries: ['CO'],
        ageMin: 22,
        ageMax: 50,
        behaviors: [
          { id: '6002714895172', name: 'Engaged Shoppers' }
        ],
        interests: [
          { id: '6003094589572', name: 'Online shopping' },
          { id: '6002714895172', name: 'Shopping and fashion' }
        ],
        platforms: ['facebook', 'instagram']
      },

      // Education / Courses
      educacion_colombia: {
        name: 'Educación Colombia',
        countries: ['CO'],
        ageMin: 20,
        ageMax: 45,
        interests: [
          { id: '6003172932634', name: 'Online learning' },
          { id: '6003048629572', name: 'Education' },
          { id: '6003276909572', name: 'Professional development' }
        ],
        platforms: ['facebook', 'instagram']
      }
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  UI: Configure audience in Ads Manager (like Operator 6:50)
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Configure audience in Ads Manager UI
   */
  async configureAudienceInUI(audienceConfig, computerUse) {
    const steps = [];
    const { location, ageMin, ageMax, interests = [], gender } = audienceConfig;

    // 1. Location
    if (location) {
      steps.push(
        { action: 'click', target: 'Editar', description: 'Open location editor', waitAfter: 1000 },
        { action: 'type', target: 'Ubicaciones', text: location, description: 'Type location', waitAfter: 1500 },
        { action: 'press', key: 'Enter', description: 'Confirm location' }
      );
    }

    // 2. Age
    if (ageMin || ageMax) {
      if (ageMin && ageMin !== 18) {
        steps.push(
          { action: 'type', target: 'Edad mínima', text: String(ageMin), description: 'Set min age', clear: true, waitAfter: 500 }
        );
      }
      if (ageMax && ageMax !== 65) {
        steps.push(
          { action: 'type', target: 'Edad máxima', text: String(ageMax), description: 'Set max age', clear: true, waitAfter: 500 }
        );
      }
    }

    // 3. Gender
    if (gender) {
      steps.push(
        { action: 'click', target: gender === 'male' ? 'Hombres' : 'Mujeres', description: 'Select gender', waitAfter: 500 }
      );
    }

    // 4. Interests
    for (const interest of interests) {
      steps.push(
        { action: 'type', target: 'Intereses detallados', text: interest, description: `Add interest: ${interest}`, waitAfter: 1500 },
        { action: 'press', key: 'Enter', description: 'Confirm interest', waitAfter: 500 }
      );
    }

    // Execute workflow
    if (computerUse && steps.length > 0) {
      return await computerUse.executeWorkflow(steps, { stopOnError: false });
    }

    return { ok: true, steps, count: steps.length };
  }

  /**
   * Format audience config as readable text
   */
  formatAudienceSummary(config) {
    const { targeting } = this.buildTargeting(config);
    let summary = '🎯 AUDIENCIA CONFIGURADA:\n';
    summary += `   Ubicación: ${targeting.geo_locations.countries?.join(', ') || 'Personalizada'}\n`;
    summary += `   Edad: ${targeting.age_min} - ${targeting.age_max} años\n`;
    if (targeting.genders?.length) {
      const g = targeting.genders.includes(1) ? 'Hombres' : '';
      const f = targeting.genders.includes(2) ? 'Mujeres' : '';
      summary += `   Género: ${[g, f].filter(Boolean).join(' y ') || 'Todos'}\n`;
    }
    if (targeting.flexible_spec) {
      for (const spec of targeting.flexible_spec) {
        if (spec.interests) summary += `   Intereses: ${spec.interests.map(i => i.name).join(', ')}\n`;
        if (spec.behaviors) summary += `   Comportamientos: ${spec.behaviors.map(b => b.name).join(', ')}\n`;
      }
    }
    summary += `   Plataformas: ${targeting.publisher_platforms.join(', ')}\n`;
    return summary;
  }
}

export default FacebookAudienceBuilder;
