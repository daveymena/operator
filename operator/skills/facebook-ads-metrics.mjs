/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║    Operator Pro — Facebook Ads Metrics Analysis Skill           ║
 * ║    (Como ChatGPT Operator 10:39 — Analizar métricas)            ║
 * ╚══════════════════════════════════════════════════════════════════╝
 * 
 * Capabilities:
 * - Read campaign metrics from Ads Manager UI
 * - Read metrics from Meta Graph API (faster)
 * - Compare campaigns side by side
 * - Detect underperforming ads
 * - Generate optimization recommendations
 * - Export data as CSV/JSON
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getBrowser } from '../engines/browser.mjs';
import { getComputerUse } from '../engines/computer-use.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GRAPH = 'https://graph.facebook.com/v21.0';

export class FacebookAdsMetrics {
  constructor(opts = {}) {
    this.adAccountId = opts.adAccountId || process.env.FACEBOOK_AD_ACCOUNT || '';
    this.verbose = opts.verbose || false;
    this.browser = getBrowser(opts);
    this.computer = null;
  }

  _getToken() {
    try {
      const tokenFile = path.join(__dirname, '..', '..', 'facebook-automation', 'tokens', 'fb_tokens_output.json');
      const data = JSON.parse(fs.readFileSync(tokenFile, 'utf8'));
      return data.accessToken || data.access_token;
    } catch {
      return process.env.FACEBOOK_ACCESS_TOKEN || '';
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  API METHOD: Get metrics directly (fast, reliable)
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Get campaign metrics via Meta Graph API
   */
  async getCampaignMetrics(opts = {}) {
    const token = this._getToken();
    if (!token) return { ok: false, error: 'No access token' };

    const {
      datePreset = 'last_30d',  // last_7d, last_14d, last_30d, today, yesterday
      level = 'campaign',         // campaign, adset, ad
      limit = 25
    } = opts;

    const fields = [
      'campaign_name', 'campaign_id', 'objective',
      'impressions', 'clicks', 'spend', 'reach',
      'ctr', 'cpc', 'cpm', 'cpp',
      'actions', 'cost_per_action_type',
      'frequency', 'unique_clicks', 'unique_ctr'
    ].join(',');

    try {
      const url = `${GRAPH}/act_${this.adAccountId}/insights?` + new URLSearchParams({
        level, fields, date_preset: datePreset,
        limit: String(limit),
        access_token: token
      });

      const res = await fetch(url);
      const data = await res.json();

      if (!data.data) return { ok: false, error: JSON.stringify(data) };

      // Process and enrich data
      const campaigns = data.data.map(c => ({
        id: c.campaign_id,
        name: c.campaign_name,
        objective: c.objective,
        impressions: parseInt(c.impressions || 0),
        clicks: parseInt(c.clicks || 0),
        spend: parseFloat(c.spend || 0),
        reach: parseInt(c.reach || 0),
        ctr: parseFloat(c.ctr || 0),
        cpc: parseFloat(c.cpc || 0),
        cpm: parseFloat(c.cpm || 0),
        frequency: parseFloat(c.frequency || 0),
        uniqueClicks: parseInt(c.unique_clicks || 0),
        actions: c.actions || [],
        datePreset
      }));

      // Calculate totals
      const totals = campaigns.reduce((acc, c) => ({
        impressions: acc.impressions + c.impressions,
        clicks: acc.clicks + c.clicks,
        spend: acc.spend + c.spend,
        reach: acc.reach + c.reach
      }), { impressions: 0, clicks: 0, spend: 0, reach: 0 });

      totals.ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions * 100) : 0;
      totals.cpc = totals.clicks > 0 ? (totals.spend / totals.clicks) : 0;
      totals.cpm = totals.impressions > 0 ? (totals.spend / totals.impressions * 1000) : 0;

      return {
        ok: true,
        campaigns,
        totals,
        count: campaigns.length,
        datePreset,
        level
      };

    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  /**
   * Get ad set level metrics
   */
  async getAdSetMetrics(campaignId, opts = {}) {
    const token = this._getToken();
    if (!token) return { ok: false, error: 'No access token' };

    const fields = [
      'adset_name', 'adset_id', 'campaign_name',
      'impressions', 'clicks', 'spend', 'reach',
      'ctr', 'cpc', 'cpm', 'frequency',
      'targeting'
    ].join(',');

    try {
      const endpoint = campaignId
        ? `${GRAPH}/${campaignId}/insights`
        : `${GRAPH}/act_${this.adAccountId}/insights`;

      const url = `${endpoint}?` + new URLSearchParams({
        level: 'adset', fields,
        date_preset: opts.datePreset || 'last_30d',
        limit: String(opts.limit || 25),
        access_token: token
      });

      const res = await fetch(url);
      const data = await res.json();

      if (!data.data) return { ok: false, error: JSON.stringify(data) };

      return { ok: true, adSets: data.data, count: data.data.length };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  /**
   * Get creative/ad level metrics
   */
  async getAdMetrics(adSetId, opts = {}) {
    const token = this._getToken();
    if (!token) return { ok: false, error: 'No access token' };

    const fields = [
      'ad_name', 'ad_id', 'adset_name',
      'impressions', 'clicks', 'spend',
      'ctr', 'cpc', 'cpm',
      'actions', 'cost_per_action_type'
    ].join(',');

    try {
      const endpoint = adSetId
        ? `${GRAPH}/${adSetId}/insights`
        : `${GRAPH}/act_${this.adAccountId}/insights`;

      const url = `${endpoint}?` + new URLSearchParams({
        level: 'ad', fields,
        date_preset: opts.datePreset || 'last_30d',
        limit: String(opts.limit || 50),
        access_token: token
      });

      const res = await fetch(url);
      const data = await res.json();

      if (!data.data) return { ok: false, error: JSON.stringify(data) };

      return { ok: true, ads: data.data, count: data.data.length };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  ANALYSIS: Find insights and recommendations
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Analyze campaigns and generate insights
   */
  async analyze(opts = {}) {
    const metrics = await this.getCampaignMetrics(opts);
    if (!metrics.ok) return metrics;

    const { campaigns, totals } = metrics;
    const insights = [];

    // 1. Best performing campaign
    if (campaigns.length > 0) {
      const best = [...campaigns].sort((a, b) => b.ctr - a.ctr)[0];
      insights.push({
        type: 'positive',
        title: '🏆 Mejor campaña por CTR',
        detail: `${best.name} — CTR: ${best.ctr.toFixed(2)}%, ${best.clicks} clicks, $${best.spend.toFixed(0)} gastados`
      });
    }

    // 2. Worst performing campaign
    if (campaigns.length > 1) {
      const worst = [...campaigns].sort((a, b) => a.ctr - b.ctr)[0];
      if (worst.ctr < 1) {
        insights.push({
          type: 'warning',
          title: '⚠️ Campaña con bajo CTR',
          detail: `${worst.name} — CTR: ${worst.ctr.toFixed(2)}%. Considera cambiar el creativo o la audiencia.`,
          recommendation: 'Prueba nuevos textos de anuncio e imágenes más llamativas'
        });
      }
    }

    // 3. High frequency warning
    const highFreq = campaigns.filter(c => c.frequency > 3);
    if (highFreq.length > 0) {
      insights.push({
        type: 'warning',
        title: '🔄 Fatiga de audiencia detectada',
        detail: `${highFreq.length} campaña(s) con frecuencia > 3: ${highFreq.map(c => c.name).join(', ')}`,
        recommendation: 'Amplía la audiencia o refresca los creativos'
      });
    }

    // 4. Budget efficiency
    if (totals.spend > 0 && totals.clicks > 0) {
      const avgCpc = totals.spend / totals.clicks;
      insights.push({
        type: avgCpc < 500 ? 'positive' : 'warning',
        title: avgCpc < 500 ? '💰 CPC eficiente' : '💸 CPC alto',
        detail: `CPC promedio: $${avgCpc.toFixed(0)} COP — ${totals.clicks} clicks por $${totals.spend.toFixed(0)}`
      });
    }

    // 5. Spend distribution
    if (campaigns.length > 1) {
      const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0);
      const topSpender = [...campaigns].sort((a, b) => b.spend - a.spend)[0];
      const pct = totalSpend > 0 ? (topSpender.spend / totalSpend * 100).toFixed(0) : 0;
      if (pct > 70) {
        insights.push({
          type: 'info',
          title: '📊 Concentración de presupuesto',
          detail: `"${topSpender.name}" consume el ${pct}% del presupuesto total`
        });
      }
    }

    // 6. Low impression campaigns
    const lowImpression = campaigns.filter(c => c.impressions < 100);
    if (lowImpression.length > 0) {
      insights.push({
        type: 'info',
        title: '📉 Campañas con pocas impresiones',
        detail: `${lowImpression.map(c => c.name).join(', ')} — menos de 100 impresiones`,
        recommendation: 'Revisa si están activas y si la audiencia no es muy reducida'
      });
    }

    return {
      ok: true,
      metrics,
      insights,
      summary: {
        totalCampaigns: campaigns.length,
        totalSpend: totals.spend,
        totalClicks: totals.clicks,
        totalImpressions: totals.impressions,
        avgCtr: totals.ctr,
        avgCpc: totals.cpc,
        avgCpm: totals.cpm
      }
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  UI METHOD: Read metrics from Ads Manager (like ChatGPT Operator)
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Navigate to Ads Manager and read metrics from the UI
   * This is what ChatGPT Operator does at 10:39 in the video
   */
  async readMetricsFromUI(opts = {}) {
    if (!this.computer) {
      const { ComputerUseEngine } = await import('../engines/computer-use.mjs');
      this.computer = new ComputerUseEngine({ verbose: this.verbose });
    }

    // Navigate to Ads Manager
    const adsUrl = `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${this.adAccountId}`;
    await this.browser.goto({ url: adsUrl, wait: 5000 });

    // Wait for table to load
    await this._sleep(3000);

    // Take screenshot
    await this.computer.observe();

    // Extract table data from DOM
    const tableData = await this.browser.page.evaluate(() => {
      const rows = document.querySelectorAll('table tr, [role="row"], [data-testid*="campaign"]');
      const data = [];
      rows.forEach(row => {
        const cells = row.querySelectorAll('td, [role="gridcell"], span');
        const rowData = {};
        cells.forEach((cell, i) => {
          const text = cell.textContent?.trim();
          if (text) rowData[`col_${i}`] = text;
        });
        if (Object.keys(rowData).length > 0) data.push(rowData);
      });
      return data;
    });

    return {
      ok: true,
      tableData,
      rowCount: tableData.length,
      source: 'ui'
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  EXPORT
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Export metrics as formatted text
   */
  formatReport(analysis) {
    if (!analysis.ok) return `Error: ${analysis.error}`;

    const { summary, insights, metrics } = analysis;
    let report = `
╔══════════════════════════════════════════════════════════════╗
║          📊 REPORTE DE FACEBOOK ADS — OPERATOR PRO          ║
╚══════════════════════════════════════════════════════════════╝

📋 RESUMEN (${metrics.datePreset}):
   Campañas:    ${summary.totalCampaigns}
   Inversión:   $${summary.totalSpend.toFixed(0)} COP
   Impresiones: ${summary.totalImpressions.toLocaleString()}
   Clicks:      ${summary.totalClicks.toLocaleString()}
   CTR Promedio: ${summary.avgCtr.toFixed(2)}%
   CPC Promedio: $${summary.avgCpc.toFixed(0)} COP
   CPM Promedio: $${summary.avgCpm.toFixed(0)} COP

💡 INSIGHTS:
`;

    insights.forEach(i => {
      report += `\n   ${i.title}\n   ${i.detail}`;
      if (i.recommendation) report += `\n   → ${i.recommendation}`;
      report += '\n';
    });

    report += `\n📊 DETALLE POR CAMPAÑA:\n`;
    report += `${'─'.repeat(60)}\n`;
    
    metrics.campaigns.forEach(c => {
      report += `   ${c.name}\n`;
      report += `   Impressions: ${c.impressions.toLocaleString()} | Clicks: ${c.clicks} | CTR: ${c.ctr.toFixed(2)}%\n`;
      report += `   Spend: $${c.spend.toFixed(0)} | CPC: $${c.cpc.toFixed(0)} | CPM: $${c.cpm.toFixed(0)}\n`;
      report += `${'─'.repeat(60)}\n`;
    });

    return report;
  }

  async exportCSV(analysis, filepath) {
    if (!analysis.ok) return { ok: false, error: analysis.error };
    
    const header = 'Campaign,Impressions,Clicks,Spend,CTR,CPC,CPM,Reach,Frequency\n';
    const rows = analysis.metrics.campaigns.map(c =>
      `"${c.name}",${c.impressions},${c.clicks},${c.spend},${c.ctr},${c.cpc},${c.cpm},${c.reach},${c.frequency}`
    ).join('\n');

    fs.writeFileSync(filepath, header + rows);
    return { ok: true, path: filepath, rows: analysis.metrics.campaigns.length };
  }

  _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
}

export default FacebookAdsMetrics;
