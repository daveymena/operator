/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║          🔍 Deep Research Engine — v4.0                      ║
 * ║   Multi-step web research, source verification,             ║
 * ║   report generation, citation tracking                      ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * Inspired by OpenAI's Deep Research — but powered by
 * OpenCode Zen + GMI Cloud with transparent provider routing.
 *
 * Flow:
 * 1. Analyze research query
 * 2. Generate search queries
 * 3. Execute web searches (via browser + search engines)
 * 4. Extract and verify information from sources
 * 5. Synthesize findings into a comprehensive report
 * 6. Generate citations and references
 */

import { EventEmitter } from 'events';
import { getGateway } from '../gateway/index.mjs';

export class DeepResearch extends EventEmitter {
  constructor(config = {}) {
    super();
    this.gateway = getGateway(config.gateway);
    this.verbose = config.verbose || false;
    this.maxSearches = config.maxSearches || 5;
    this.maxDepth = config.maxDepth || 3;
    this.model = config.model || 'deepseek-v4-pro';
    this.fastModel = config.fastModel || 'gemini-3-flash';
  }

  /**
   * Execute a deep research task
   * @param {string} query - Research question/topic
   * @param {Object} options - Options (depth, format, language, etc.)
   * @returns {Object} Research result with report, sources, citations
   */
  async research(query, options = {}) {
    const startTime = Date.now();
    const language = options.language || 'es';
    const format = options.format || 'markdown'; // markdown, json, html
    const depth = Math.min(options.depth || 2, this.maxDepth);

    this.emit('research:start', { query, depth });

    // Phase 1: Analyze and plan
    this.emit('research:phase', { phase: 'analyzing', query });
    const analysis = await this._analyzeQuery(query, language);

    // Phase 2: Search
    this.emit('research:phase', { phase: 'searching', queries: analysis.searchQueries });
    const searchResults = await this._executeSearches(analysis.searchQueries, options);

    // Phase 3: Extract and verify
    this.emit('research:phase', { phase: 'extracting', sources: searchResults.length });
    const extracted = await this._extractInformation(query, searchResults, language);

    // Phase 4: Deep dive (if depth > 1)
    let deepFindings = [];
    if (depth > 1 && extracted.followUpQueries?.length > 0) {
      this.emit('research:phase', { phase: 'deep-diving', queries: extracted.followUpQueries });
      const deepResults = await this._executeSearches(
        extracted.followUpQueries.slice(0, 3), options
      );
      deepFindings = await this._extractInformation(query, deepResults, language);
    }

    // Phase 5: Synthesize report
    this.emit('research:phase', { phase: 'synthesizing' });
    const report = await this._synthesizeReport(query, {
      analysis,
      searchResults,
      extracted,
      deepFindings,
      language,
      format
    });

    const duration = Date.now() - startTime;
    const result = {
      ok: true,
      query,
      report: report.content,
      summary: report.summary,
      sources: report.sources,
      citations: report.citations,
      confidence: report.confidence,
      depth,
      duration,
      searchesPerformed: searchResults.length + (deepFindings.length || 0),
      model: this.model,
      timestamp: new Date().toISOString()
    };

    this.emit('research:complete', result);
    return result;
  }

  // ─── Phase 1: Analyze Query ─────────────────────────────────────────────

  async _analyzeQuery(query, language) {
    const prompt = `You are a research analyst. Analyze this research query and generate optimal search queries.

Research Query: "${query}"

Respond with JSON only:
{
  "topic": "Main topic classification",
  "subtopics": ["subtopic1", "subtopic2"],
  "searchQueries": [
    "specific search query 1",
    "specific search query 2",
    "specific search query 3",
    "specific search query 4",
    "specific search query 5"
  ],
  "keyAspects": ["aspect1", "aspect2", "aspect3"],
  "expectedSources": ["academic", "news", "official", "forums"],
  "difficulty": "easy|medium|hard",
  "timeSensitivity": "low|medium|high"
}`;

    const result = await this.gateway.chat({
      model: this.fastModel,
      messages: [{ role: 'user', content: prompt }],
      options: { temperature: 0.3, max_tokens: 2000 }
    });

    try {
      const content = result.content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      return jsonMatch ? JSON.parse(jsonMatch[0]) : { searchQueries: [query], keyAspects: [] };
    } catch {
      return { searchQueries: [query], keyAspects: [] };
    }
  }

  // ─── Phase 2: Execute Searches ──────────────────────────────────────────

  async _executeSearches(queries, options) {
    const results = [];
    const browser = options.browser; // Optional: use existing browser instance

    for (const query of queries.slice(0, this.maxSearches)) {
      try {
        this.emit('research:search', { query });

        // Use browser automation if available, otherwise use AI to synthesize
        if (browser) {
          const searchResult = await this._browserSearch(browser, query);
          results.push(searchResult);
        } else {
          // Fallback: use AI with its training data
          const aiResult = await this._aiSearch(query);
          results.push(aiResult);
        }
      } catch (error) {
        this._log(`Search failed for "${query}": ${error.message}`);
      }
    }

    return results;
  }

  async _browserSearch(browser, query) {
    // Navigate to search engine and extract results
    try {
      await browser.goto(`https://www.google.com/search?q=${encodeURIComponent(query)}`);
      await browser.waitForSelector('#search', { timeout: 10000 }).catch(() => {});

      // Extract search result snippets
      const page = browser.getPage();
      if (!page) return { query, source: 'browser', content: '', urls: [] };

      const results = await page.evaluate(() => {
        const items = [];
        document.querySelectorAll('div.g, div[data-ved]').forEach(el => {
          const title = el.querySelector('h3')?.textContent || '';
          const snippet = el.querySelector('[data-sncf], .VwiC3b')?.textContent || '';
          const url = el.querySelector('a')?.href || '';
          if (title || snippet) {
            items.push({ title, snippet, url });
          }
        });
        return items;
      }).catch(() => []);

      return {
        query,
        source: 'browser',
        content: results.map(r => `${r.title}: ${r.snippet}`).join('\n'),
        urls: results.map(r => r.url).filter(Boolean)
      };
    } catch {
      return { query, source: 'browser', content: '', urls: [] };
    }
  }

  async _aiSearch(query) {
    const result = await this.gateway.chat({
      model: this.model,
      messages: [{
        role: 'user',
        content: `Provide detailed factual information about: "${query}". Include specific data, statistics, dates, and verifiable facts. If you're uncertain about something, note it.`
      }],
      options: { temperature: 0.2, max_tokens: 4000 }
    });

    return {
      query,
      source: 'ai_knowledge',
      content: result.content,
      urls: [],
      model: result.model,
      provider: result.provider
    };
  }

  // ─── Phase 3: Extract Information ───────────────────────────────────────

  async _extractInformation(query, searchResults, language) {
    const combinedContent = searchResults
      .map((r, i) => `[Source ${i + 1} - ${r.source}]: ${r.content}`)
      .join('\n\n');

    const prompt = `You are a research analyst extracting key information from search results.

Research Query: "${query}"

Search Results:
${combinedContent}

Extract and organize the information. Respond with JSON only:
{
  "findings": [
    { "fact": "Specific factual finding", "confidence": 0.9, "sourceIndex": 1 }
  ],
  "keyData": [
    { "metric": "name", "value": "value", "context": "context" }
  ],
  "contradictions": [
    { "claim1": "...", "claim2": "...", "resolution": "..." }
  ],
  "gaps": ["topics that need more research"],
  "followUpQueries": ["query for deeper research"],
  "overallAssessment": "Brief assessment of information quality"
}`;

    const result = await this.gateway.chat({
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
      options: { temperature: 0.2, max_tokens: 4000 }
    });

    try {
      const content = result.content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      return jsonMatch ? JSON.parse(jsonMatch[0]) : { findings: [], gaps: [], followUpQueries: [] };
    } catch {
      return { findings: [], gaps: [], followUpQueries: [] };
    }
  }

  // ─── Phase 5: Synthesize Report ─────────────────────────────────────────

  async _synthesizeReport(query, data) {
    const { analysis, searchResults, extracted, deepFindings, language, format } = data;

    const langInstruction = language === 'es'
      ? 'Escribe el reporte en español.'
      : 'Write the report in English.';

    const formatInstruction = format === 'json'
      ? 'Return the report as a JSON object with keys: title, summary, sections (array), sources, citations.'
      : 'Return the report in Markdown format.';

    const allFindings = [
      ...(extracted.findings || []),
      ...(deepFindings?.findings || [])
    ];

    const allSources = searchResults.map((r, i) => ({
      index: i + 1,
      query: r.query,
      source: r.source,
      urls: r.urls || [],
      model: r.model
    }));

    const prompt = `You are a senior research analyst writing a comprehensive report.

Research Query: "${query}"
Topic: ${analysis.topic || 'General'}
Key Aspects: ${(analysis.keyAspects || []).join(', ')}

FINDINGS:
${JSON.stringify(allFindings, null, 2)}

KEY DATA:
${JSON.stringify(extracted.keyData || [], null, 2)}

CONTRADICTIONS:
${JSON.stringify(extracted.contradictions || [], null, 2)}

GAPS IDENTIFIED:
${(extracted.gaps || []).join(', ')}

SOURCES:
${JSON.stringify(allSources, null, 2)}

${langInstruction}
${formatInstruction}

Requirements:
1. Comprehensive analysis covering all key aspects
2. Specific data points with citations [Source N]
3. Address contradictions honestly
4. Note gaps and limitations
5. Include a confidence assessment
6. Executive summary at the top
7. All claims backed by sources`;

    const result = await this.gateway.chat({
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
      options: { temperature: 0.3, max_tokens: 8000 }
    });

    // Extract summary from report
    const summaryMatch = result.content.match(/##?\s*(?:Summary|Resumen|Executive Summary)[\s\S]*?(?=##|$)/i);
    const summary = summaryMatch ? summaryMatch[0].trim() : result.content.slice(0, 500);

    return {
      content: result.content,
      summary,
      sources: allSources,
      citations: allFindings.map(f => f.sourceIndex).filter(Boolean),
      confidence: this._calculateConfidence(allFindings, searchResults.length),
      model: result.model,
      provider: result.provider
    };
  }

  _calculateConfidence(findings, sourceCount) {
    if (findings.length === 0) return 0.1;
    const avgConfidence = findings.reduce((sum, f) => sum + (f.confidence || 0.5), 0) / findings.length;
    const sourceBonus = Math.min(sourceCount / 5, 1) * 0.2;
    return Math.min(avgConfidence + sourceBonus, 1.0);
  }

  _log(...args) {
    if (this.verbose) console.log('[RESEARCH]', ...args);
  }
}

export default DeepResearch;
