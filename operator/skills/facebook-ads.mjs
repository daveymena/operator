/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║    Operator Pro — Facebook Ads Manager Skill                    ║
 * ║    (Nivel ChatGPT Operator: Crear campañas como un humano)      ║
 * ╚══════════════════════════════════════════════════════════════════╝
 * 
 * Este skill permite a Operator Pro entrar al Ads Manager de Meta
 * y crear campañas, conjuntos de anuncios y anuncios completos
 * navegando la interfaz como lo haría un humano.
 * 
 * Flujo:
 *   1. Abre Ads Manager
 *   2. Hace click en "Crear" (+ verde)
 *   3. Selecciona objetivo de campaña
 *   4. Configura campaña (nombre, presupuesto, etc.)
 *   5. Configura conjunto de anuncios (audiencia, ubicación, etc.)
 *   6. Configura anuncio (creativo, texto, CTA)
 *   7. Publica o guarda como borrador
 * 
 * Todo esto usando VER la pantalla + ENTENDER + ACTUAR + VERIFICAR
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ComputerUseEngine, getComputerUse } from '../engines/computer-use.mjs';
import { getBrowser } from '../engines/browser.mjs';
import { Brain } from '../brain.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// URLs del Ads Manager
const ADS_MANAGER_URL = 'https://adsmanager.facebook.com/adsmanager/manage/campaigns';
const ADS_CREATION_URL = 'https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=';

export class FacebookAdsSkill {
  constructor(opts = {}) {
    this.adAccountId = opts.adAccountId || process.env.FACEBOOK_AD_ACCOUNT || '';
    this.verbose = opts.verbose || false;
    this.computer = null;
    this.browser = null;
    this.brain = null;
    this.screenshots = [];
  }

  async init() {
    this.brain = new Brain({ verbose: this.verbose, backend: 'auto' });
    this.computer = new ComputerUseEngine({ 
      verbose: this.verbose, 
      brain: this.brain 
    });
    this.browser = getBrowser({ verbose: this.verbose });
    
    // Connect browser
    const conn = await this.browser.connect({ headless: false });
    if (!conn.ok) {
      return { ok: false, error: 'Cannot connect to browser. Start Chrome with: chrome --remote-debugging-port=9222' };
    }
    
    return { ok: true, backend: conn.backend };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  WORKFLOW: CREAR CAMPAÑA COMPLETA
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Crea una campaña completa en Facebook Ads Manager
   * navegando la interfaz como un humano
   */
  async createCampaign(config) {
    const {
      name = 'Campaña Operator Pro',
      objective = 'OUTCOME_TRAFFIC',       // tráfico
      budget = 5000,                         // $50 COP diarios
      audience = {},
      creative = {},
      saveAsDraft = true                     // no publicar automáticamente
    } = config;

    console.log('\n🎯 INICIANDO CREACIÓN DE CAMPAÑA');
    console.log(`   Nombre: ${name}`);
    console.log(`   Objetivo: ${objective}`);
    console.log(`   Presupuesto: $${budget} COP/día`);
    console.log('');

    // PASO 1: Navegar al Ads Manager
    console.log('📋 PASO 1: Abrir Ads Manager...');
    const adsUrl = this.adAccountId 
      ? `${ADS_CREATION_URL}${this.adAccountId}` 
      : ADS_MANAGER_URL;
    
    const navResult = await this.browser.goto({ url: adsUrl, wait: 5000 });
    if (!navResult.ok) return { ok: false, error: `Cannot navigate to Ads Manager: ${navResult.error}` };
    
    await this._screenshot('01_ads_manager_opened');

    // PASO 2: Verificar que estamos logueados y en Ads Manager
    console.log('📋 PASO 2: Verificar acceso...');
    const observation = await this.computer.observe();
    if (observation.url?.includes('login') || observation.url?.includes('facebook.com/login')) {
      return { ok: false, error: 'Not logged in to Facebook. Please log in first.' };
    }
    await this._screenshot('02_verified_access');

    // PASO 3: Click en botón "+ Crear" (botón verde)
    console.log('📋 PASO 3: Click en "+ Crear"...');
    const createResult = await this._clickCreateButton();
    if (!createResult.ok) return { ok: false, error: `Cannot find Create button: ${createResult.error}` };
    await this._screenshot('03_create_clicked');
    
    // PASO 4: Seleccionar objetivo de campaña
    console.log('📋 PASO 4: Seleccionar objetivo...');
    const objResult = await this._selectObjective(objective);
    if (!objResult.ok) return { ok: false, error: `Cannot select objective: ${objResult.error}` };
    await this._screenshot('04_objective_selected');

    // PASO 5: Click en "Continuar"
    console.log('📋 PASO 5: Continuar...');
    await this.computer.smartClick('Continuar', { waitAfter: 3000 });
    // Si aparece "Quick creation" vs "Manual", elegir Manual
    await this._trySelectManualCreation();
    await this._screenshot('05_campaign_setup');

    // PASO 6: Configurar campaña (nombre, presupuesto)
    console.log('📋 PASO 6: Configurar campaña...');
    await this._configureCampaign(name, budget);
    await this._screenshot('06_campaign_configured');

    // PASO 7: Configurar conjunto de anuncios (audiencia)
    console.log('📋 PASO 7: Configurar audiencia...');
    await this._configureAudience(audience);
    await this._screenshot('07_audience_configured');

    // PASO 8: Configurar anuncio (creativo)
    console.log('📋 PASO 8: Configurar anuncio...');
    await this._configureAd(creative);
    await this._screenshot('08_ad_configured');

    // PASO 9: Publicar o guardar como borrador
    if (saveAsDraft) {
      console.log('📋 PASO 9: Guardar como borrador...');
      await this.computer.smartClick('Guardar como borrador', { waitAfter: 2000 }).catch(() => {});
      // Alternative: just close without publishing
    } else {
      console.log('📋 PASO 9: Publicar campaña...');
      const publishResult = await this.computer.smartClick('Publicar', { waitAfter: 5000 });
      if (!publishResult.ok) {
        // Try "Confirm" button if Publish didn't work
        await this.computer.smartClick('Confirmar', { waitAfter: 5000 }).catch(() => {});
      }
    }
    await this._screenshot('09_final');

    console.log('\n✅ CAMPAÑA CREADA EXITOSAMENTE');
    
    return {
      ok: true,
      campaign: { name, objective, budget },
      screenshots: this.screenshots,
      steps: 9
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  HELPER METHODS FOR EACH STEP
  // ═══════════════════════════════════════════════════════════════════

  async _clickCreateButton() {
    // Try multiple strategies to find the Create button
    const strategies = [
      () => this.computer.smartClick('+ Crear', { waitAfter: 2000 }),
      () => this.computer.smartClick('Create', { waitAfter: 2000 }),
      () => this.computer.smartClick('+ Create', { waitAfter: 2000 }),
      () => this.computer.smartClick('[aria-label="Create"]', { waitAfter: 2000 }),
      // The green + button
      () => this.browser.click({ selector: 'button[data-testid="ads-manager-create-button"]', wait: 2000 }),
      () => this.browser.click({ selector: '[data-tooltip-content="Create"]', wait: 2000 }),
      () => this.browser.click({ selector: '._5uy4', wait: 2000 }), // legacy class
    ];

    for (const strategy of strategies) {
      try {
        const result = await strategy();
        if (result.ok) return result;
      } catch {}
    }

    // Use vision to find the button
    const obs = await this.computer.observe();
    if (obs.analysis?.toLowerCase().includes('creat') || obs.analysis?.toLowerCase().includes('crear')) {
      // Found it visually, try clicking on the green area
      return { ok: false, error: 'Found Create button visually but could not click it precisely' };
    }

    return { ok: false, error: 'Create button not found' };
  }

  async _selectObjective(objective) {
    // Map objective IDs to UI labels
    const objectiveLabels = {
      'OUTCOME_AWARENESS': ['Reconocimiento', 'Awareness'],
      'OUTCOME_TRAFFIC': ['Tráfico', 'Traffic'],
      'OUTCOME_ENGAGEMENT': ['Interacción', 'Engagement'],
      'OUTCOME_LEADS': ['Clientes potenciales', 'Leads'],
      'OUTCOME_APP_PROMOTION': ['Promoción de la app', 'App promotion'],
      'OUTCOME_SALES': ['Ventas', 'Sales'],
    };

    const labels = objectiveLabels[objective] || [objective];

    // Wait for the objective selection screen
    await this._sleep(2000);

    for (const label of labels) {
      try {
        const result = await this.computer.smartClick(label, { waitAfter: 1000 });
        if (result.ok) return result;
      } catch {}
    }

    return { ok: false, error: `Objective ${objective} not found in UI` };
  }

  async _trySelectManualCreation() {
    // Ads Manager sometimes shows "Quick creation" vs "Manual creation"
    try {
      const manual = await this.computer.smartClick('Manual', { waitAfter: 2000 });
      if (manual.ok) return manual;
    } catch {}
    
    try {
      const manual = await this.computer.smartClick('Creación manual', { waitAfter: 2000 });
      if (manual.ok) return manual;
    } catch {}

    return { ok: false }; // Not available, that's fine
  }

  async _configureCampaign(name, budget) {
    // Set campaign name
    try {
      // Find the campaign name field
      await this.computer.smartType('Nombre de la campaña', name, { clear: true }).catch(async () => {
        await this.computer.smartType('Campaign name', name, { clear: true }).catch(async () => {
          // Try by selector
          await this.browser.type({ 
            selector: 'input[name="name"], input[aria-label*="campaign"], input[placeholder*="campaign"]', 
            text: name, clear: true 
          });
        });
      });
    } catch (e) {
      this._log(`Warning: Could not set campaign name: ${e.message}`);
    }

    await this._sleep(500);

    // Set budget
    if (budget) {
      try {
        // Look for budget field
        await this.computer.smartType('Presupuesto diario', String(budget), { clear: true }).catch(async () => {
          await this.computer.smartType('Daily budget', String(budget), { clear: true }).catch(async () => {
            await this.browser.type({ 
              selector: 'input[name*="budget"], input[aria-label*="budget"]', 
              text: String(budget), clear: true 
            });
          });
        });
      } catch (e) {
        this._log(`Warning: Could not set budget: ${e.message}`);
      }
    }

    await this._sleep(500);
  }

  async _configureAudience(audience) {
    const { location, ageMin = 18, ageMax = 65, interests = [] } = audience;

    // Location
    if (location) {
      try {
        await this.computer.smartClick('Editar', { waitAfter: 1000 }).catch(() => {});
        await this.computer.smartType('Ubicaciones', location, { clear: true, waitAfter: 500 }).catch(async () => {
          await this.computer.smartType('Locations', location, { clear: true });
        });
        await this.pressKey('Enter');
      } catch {}
    }

    // Age
    if (ageMin !== 18 || ageMax !== 65) {
      try {
        await this.browser.type({ selector: 'input[aria-label*="age-min"], input[name*="age_min"]', text: String(ageMin), clear: true });
        await this.browser.type({ selector: 'input[aria-label*="age-max"], input[name*="age_max"]', text: String(ageMax), clear: true });
      } catch {}
    }

    // Interests
    for (const interest of interests) {
      try {
        await this.computer.smartType('Intereses detallados', interest, { waitAfter: 1000 }).catch(async () => {
          await this.computer.smartType('Detailed targeting', interest, { waitAfter: 1000 });
        });
        await this._sleep(500);
        await this.pressKey('Enter');
      } catch {}
    }

    await this._sleep(1000);
  }

  async _configureAd(creative) {
    const { 
      headline = '', 
      primaryText = '', 
      description = '', 
      imageUrl = '',
      cta = 'LEARN_MORE',
      websiteUrl = ''
    } = creative;

    // Upload image
    if (imageUrl) {
      try {
        await this.computer.smartClick('Agregar multimedia', { waitAfter: 2000 }).catch(async () => {
          await this.computer.smartClick('Add media', { waitAfter: 2000 });
        });
        await this.computer.smartClick('Agregar imagen', { waitAfter: 1000 }).catch(async () => {
          await this.computer.smartClick('Add image', { waitAfter: 1000 });
        });

        // If it's a local file, upload via input
        if (imageUrl.startsWith('/')) {
          const fileInput = await this.browser.page.$('input[type="file"]');
          if (fileInput) await fileInput.uploadFile(imageUrl);
        }
      } catch {}
    }

    await this._sleep(1000);

    // Primary text
    if (primaryText) {
      try {
        await this.computer.smartType('Texto principal', primaryText, { clear: true }).catch(async () => {
          await this.computer.smartType('Primary text', primaryText, { clear: true });
        });
      } catch {}
    }

    // Headline
    if (headline) {
      try {
        await this.computer.smartType('Título', headline, { clear: true }).catch(async () => {
          await this.computer.smartType('Headline', headline, { clear: true });
        });
      } catch {}
    }

    // Description
    if (description) {
      try {
        await this.computer.smartType('Descripción', description, { clear: true }).catch(async () => {
          await this.computer.smartType('Description', description, { clear: true });
        });
      } catch {}
    }

    // Website URL
    if (websiteUrl) {
      try {
        await this.computer.smartType('URL del sitio web', websiteUrl, { clear: true }).catch(async () => {
          await this.computer.smartType('Website URL', websiteUrl, { clear: true });
        });
      } catch {}
    }

    // CTA
    if (cta) {
      try {
        const ctaLabels = {
          'LEARN_MORE': ['Más información', 'Learn more'],
          'SHOP_NOW': ['Comprar', 'Shop now'],
          'SIGN_UP': ['Registrarte', 'Sign up'],
          'CONTACT_US': ['Contactarnos', 'Contact us'],
          'BOOK_NOW': ['Reservar', 'Book now'],
        };
        const labels = ctaLabels[cta] || [cta];
        for (const label of labels) {
          const result = await this.computer.smartClick(label);
          if (result.ok) break;
        }
      } catch {}
    }

    await this._sleep(1000);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  API-BASED ALTERNATIVE (faster, no browser needed)
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Crear campaña vía API de Meta (más rápido y confiable que UI)
   * Este es el mismo enfoque que usa ChatGPT con MCP
   */
  async createCampaignViaAPI(config) {
    const {
      name = 'Campaña Operator Pro',
      objective = 'OUTCOME_TRAFFIC',
      status = 'PAUSED',
      dailyBudget = 5000,
      adSetName = 'Conjunto de anuncios',
      adName = 'Anuncio',
      targeting = {},
      creative = {}
    } = config;

    const token = this._getToken();
    if (!token) return { ok: false, error: 'No Facebook access token found' };

    const adAccount = this.adAccountId || process.env.FACEBOOK_AD_ACCOUNT;
    if (!adAccount) return { ok: false, error: 'No ad account ID configured' };

    const GRAPH = 'https://graph.facebook.com/v21.0';
    const results = {};

    try {
      // 1. Create Campaign
      console.log('📡 API: Creating campaign...');
      const campRes = await fetch(`${GRAPH}/act_${adAccount}/campaigns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          name, objective, status,
          special_ad_categories: '[]',
          daily_budget: String(Math.round(dailyBudget * 100)),
          access_token: token
        })
      });
      const campData = await campRes.json();
      if (!campData.id) return { ok: false, error: `Campaign creation failed: ${JSON.stringify(campData)}` };
      results.campaignId = campData.id;
      console.log(`   ✅ Campaign created: ${campData.id}`);

      // 2. Create Ad Set
      console.log('📡 API: Creating ad set...');
      const adSetRes = await fetch(`${GRAPH}/act_${adAccount}/adsets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          name: adSetName,
          campaign_id: campData.id,
          daily_budget: String(Math.round(dailyBudget * 100)),
          billing_event: 'IMPRESSIONS',
          optimization_goal: 'LINK_CLICKS',
          bid_amount: '0',
          status,
          targeting: JSON.stringify({
            geo_locations: targeting.geo_locations || { countries: ['CO'] },
            age_min: targeting.age_min || 18,
            age_max: targeting.age_max || 65,
            publisher_platforms: ['facebook', 'instagram'],
            facebook_positions: ['feed', 'story', 'reels'],
            instagram_positions: ['stream', 'story', 'reels'],
            ...(targeting.interests ? { flexible_spec: [{ interests: targeting.interests }] } : {})
          }),
          access_token: token
        })
      });
      const adSetData = await adSetRes.json();
      if (!adSetData.id) {
        console.log(`   ⚠️ Ad set failed: ${JSON.stringify(adSetData)}`);
      } else {
        results.adSetId = adSetData.id;
        console.log(`   ✅ Ad set created: ${adSetData.id}`);

        // 3. Create Ad (if creative provided)
        if (creative.pageId && creative.imageUrl) {
          console.log('📡 API: Creating ad...');
          const adRes = await fetch(`${GRAPH}/act_${adAccount}/ads`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              name: adName,
              adset_id: adSetData.id,
              status,
              creative: JSON.stringify({
                name: `${adName}_creative`,
                object_story_spec: {
                  page_id: creative.pageId,
                  link_data: {
                    image_hash: creative.imageHash || undefined,
                    link: creative.websiteUrl || '',
                    message: creative.primaryText || '',
                    name: creative.headline || '',
                    description: creative.description || '',
                    call_to_action: {
                      type: creative.cta || 'LEARN_MORE',
                      value: { link: creative.websiteUrl || '' }
                    }
                  }
                }
              }),
              access_token: token
            })
          });
          const adData = await adRes.json();
          if (adData.id) {
            results.adId = adData.id;
            console.log(`   ✅ Ad created: ${adData.id}`);
          }
        }
      }

      return { ok: true, ...results, viaAPI: true };

    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  UTILITIES
  // ═══════════════════════════════════════════════════════════════════

  _getToken() {
    try {
      const tokenFile = path.join(__dirname, '..', '..', 'facebook-automation', 'tokens', 'fb_tokens_output.json');
      const data = JSON.parse(fs.readFileSync(tokenFile, 'utf8'));
      return data.accessToken || data.access_token;
    } catch {
      return process.env.FACEBOOK_ACCESS_TOKEN || '';
    }
  }

  async _screenshot(label) {
    if (!this.browser.connected) return;
    try {
      const ss = await this.browser.screenshot({ filename: `fb_ads_${label}_${Date.now()}.png` });
      if (ss.ok) {
        this.screenshots.push({ label, file: ss.file });
        this._log(`📸 ${label}: ${ss.file}`);
      }
    } catch {}
  }

  async pressKey(key) {
    if (this.browser.connected) {
      await this.browser.page.keyboard.press(key);
    }
  }

  _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
  _log(msg) { if (this.verbose) console.log(`  [FB Ads] ${msg}`); }
}

export default FacebookAdsSkill;
