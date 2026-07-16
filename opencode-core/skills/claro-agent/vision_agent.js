const { solveCaptchaMultiRound } = require("./captcha_solver_final.js");
const { askAI, executeAIAction } = require("./ai_supervisor.js");

function delay(ms) {
  return new Promise(r => setTimeout(r, ms + Math.random() * 100));
}

async function getPageNumber(page) {
  return await page.evaluate(() => {
    const m = document.body.innerText.match(/Página\s*(\d+)\s*de\s*(\d+)/i);
    if (m) return { current: parseInt(m[1]), total: parseInt(m[2]) };
    return null;
  }).catch(() => null);
}

async function clickBtn(page, text) {
  for (let i = 0; i < 10; i++) {
    try {
      const ok = await page.evaluate((t) => {
        const btns = document.querySelectorAll('[role="button"], button, input[type="submit"]');
        for (const b of btns) {
          const btnText = (b.innerText || b.value || "").trim().toLowerCase();
          if (btnText === t.toLowerCase() || btnText.includes(t.toLowerCase())) {
            if (b.offsetWidth > 0 && b.offsetHeight > 0 && window.getComputedStyle(b).visibility !== 'hidden') {
              b.scrollIntoView({block: "center"});
              b.click();
              return true;
            }
          }
        }
        return false;
      }, text);
      if (ok) { await delay(800); return true; }
    } catch (_) {}
    await delay(500);
  }
  return false;
}

async function waitForPageTransition(page, oldPageNum) {
  for (let w = 0; w < 15; w++) {
    const pgn = await getPageNumber(page);
    if (pgn && pgn.current !== oldPageNum) return pgn;
    await delay(1000);
  }
  return null;
}

async function agentLoop(page, order, fillFieldsFn) {
  let noProgressCount = 0;
  let captchaFails = 0;
  let lastPageNum = 0;
  let submitAttempted = false; // EVITAR DUPLICADOS: marcar después del primer intento de envío

  async function findEnviarBtn() {
    return await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('[role="button"], button, input[type="submit"], span'));
      return btns.some(b => {
        const txt = (b.innerText || b.value || "").trim().toLowerCase();
        return txt === "enviar" || txt === "submit" || txt.includes("enviar");
      });
    }).catch(() => false);
  }

  for (let a = 0; a < 60; a++) {
    await delay(1500);

    // Si ya intentamos enviar, solo verificar confirmación
    if (submitAttempted) {
      const bodyCheck = await page.evaluate(() => document.body.innerText.substring(0, 500)).catch(() => "");
      if (bodyCheck.includes("hemos registrado") || bodyCheck.includes("Se ha registrado") || bodyCheck.includes("Respuesta enviada") || bodyCheck.includes("Tu respuesta ha sido registrada")) {
        console.log("  [VA] CONFIRMADO! Formulario enviado.");
        return true;
      }
      // Si pasaron 15 segundos sin confirmación, intentar una vez más
      if (a > 10) {
        console.log("  [VA] Sin confirmación tras envío, reintentando una vez...");
        submitAttempted = false;
      }
      continue;
    }

    const body = await page.evaluate(() => document.body.innerText.substring(0, 500)).catch(() => "");
    if (body.includes("hemos registrado") || body.includes("Se ha registrado") || body.includes("Respuesta enviada") || body.includes("Muchas gracias") || body.includes("Enviar otra respuesta")) {
      console.log("  [VA] CONFIRMADO! Formulario enviado.");
      return true;
    }

    const hasItems = await page.evaluate(() => document.querySelectorAll('[role="listitem"]').length > 0).catch(() => false);
    if (!hasItems) {
      const noFormFields = await page.evaluate(() => document.querySelectorAll('input.whsOnd, input[type="text"], input[type="email"]').length === 0).catch(() => false);
      if (noFormFields) {
        const body2 = await page.evaluate(() => document.body.innerText.substring(0, 300)).catch(() => "");
        if (!body2.includes("Correo electrónico") && !body2.includes("Cuenta") && !body2.includes("Orden")) {
          console.log("  [VA] No hay campos, asumiendo enviado.");
          return true;
        }
      }
    }

    const captchaVisible = await page.evaluate(() => {
      const iframe = document.querySelector('iframe[title*="recaptcha"]');
      return iframe && iframe.offsetWidth > 0 && iframe.offsetHeight > 0 && window.getComputedStyle(iframe).visibility !== 'hidden';
    }).catch(() => false);

    if (captchaVisible) {
      console.log("  [VA] Captcha detectado (intento " + (captchaFails + 1) + ")...");
      const solved = await solveCaptchaMultiRound(page);
      if (solved) {
        captchaFails = 0;
        noProgressCount = 0;
        await delay(3000);
        for (let retry = 0; retry < 5; retry++) {
          const bodyC = await page.evaluate(() => document.body.innerText.substring(0, 500)).catch(() => "");
          if (bodyC.includes("registrada") || bodyC.includes("Respuesta enviada") || bodyC.includes("hemos registrado")) {
            console.log("  [VA] ENVIADO post-captcha!");
            return true;
          }
          const envPost = await findEnviarBtn();
          if (envPost && !submitAttempted) {
            submitAttempted = true;
            console.log("  [VA] Click en Enviar post-captcha...");
            await clickBtn(page, "Enviar");
            await delay(5000);
            const bodyP = await page.evaluate(() => document.body.innerText.substring(0, 500)).catch(() => "");
            if (bodyP.includes("registrada") || bodyP.includes("Respuesta enviada") || bodyP.includes("hemos registrado")) {
              console.log("  [VA] ENVIADO post-captcha!");
              return true;
            }
          }
          await delay(2000);
        }
        continue;
      }
      captchaFails++;
      if (captchaFails >= 3) {
        console.log("  [VA] Captcha no resuelve tras 3 intentos. Reintentando envio...");
        captchaFails = 0;
        const envRetry = await findEnviarBtn();
        if (envRetry && !submitAttempted) {
          submitAttempted = true;
          console.log("  [VA] Reintentando click Enviar...");
          await clickBtn(page, "Enviar");
          await delay(5000);
          const bodyR = await page.evaluate(() => document.body.innerText.substring(0, 500)).catch(() => "");
          if (bodyR.includes("registrada") || bodyR.includes("Respuesta enviada") || bodyR.includes("hemos registrado")) {
            console.log("  [VA] ENVIADO tras reintento!");
            return true;
          }
        }
        noProgressCount = 5;
      } else {
        continue;
      }
    } else {
      captchaFails = 0;
    }

    const itemsExist = await page.evaluate(() => document.querySelectorAll('[role="listitem"]').length > 0).catch(() => false);

    if (itemsExist) {
      console.log("  [VA] Llenando campos...");
      await fillFieldsFn(page, order, false);
      noProgressCount = 0;
    }

    const pageNum = await getPageNumber(page);
    const isLastPage = pageNum && pageNum.current >= pageNum.total;

    if (!itemsExist && isLastPage && !submitAttempted) {
      console.log("  [VA] Sin campos ni items, intentando enviar...");
      const envExact = await findEnviarBtn();
      if (envExact) {
        submitAttempted = true;
        console.log("  [VA] Click en Enviar...");
        await clickBtn(page, "Enviar");
        await delay(5000);
        const bodyC = await page.evaluate(() => document.body.innerText.substring(0, 500)).catch(() => "");
        if (bodyC.includes("registrada") || bodyC.includes("Respuesta enviada") || bodyC.includes("hemos registrado")) {
          console.log("  [VA] ENVIADO!");
          return true;
        }
        noProgressCount = 0;
        continue;
      }
    }

    const envBtn = await findEnviarBtn();
    if (envBtn && !submitAttempted) {
      submitAttempted = true; // BLOQUEAR duplicados
      // Intentar envio directo (bypass captcha)
      console.log("  [VA] Intentando envio directo bypass captcha...");
      const directOk = await page.evaluate(async () => {
        const form = document.querySelector('form');
        if (!form) return false;
        const fd = new FormData(form);
        const entries = [];
        for (const [k, v] of fd.entries()) {
          if (k !== 'g-recaptcha-response') entries.push(encodeURIComponent(k) + '=' + encodeURIComponent(v));
        }
        try {
          const resp = await fetch(form.action, { method: 'POST', body: entries.join('&'), redirect: 'manual' });
          const text = await resp.text();
          if (text.includes('registrada') || text.includes('Respuesta') || text.includes('hemos registrado')) return true;
          return !!(resp.headers.get('location'));
        } catch(e) { return false; }
      }).catch(() => false);
      if (directOk) {
        console.log("  [VA] ENVIADO por bypass!");
        return true;
      }
      console.log("  [VA] Bypass fallo, usando envio normal...");

      // Marcar captcha checkbox ANTES de enviar para evitar challenge
      console.log("  [VA] Marcando captcha checkbox pre-envio...");
      const frames = page.frames();
      for (const f of frames) {
        if (f.url().includes("recaptcha/api") && !f.url().includes("bframe")) {
          try {
            const checked = await f.evaluate(() => {
              const a = document.querySelector("#recaptcha-anchor");
              return a && a.getAttribute("aria-checked") === "true";
            }).catch(() => false);
            if (!checked) {
              await f.$("#recaptcha-anchor").then(cb => cb?.click());
              await delay(3000);
            }
          } catch (e) {}
          break;
        }
      }
      console.log("  [VA] Click en Enviar...");
      await clickBtn(page, "Enviar");
      await delay(5000);
      const body2 = await page.evaluate(() => document.body.innerText.substring(0, 500)).catch(() => "");
      if (body2.includes("registrada") || body2.includes("Respuesta enviada") || body2.includes("hemos registrado")) {
        console.log("  [VA] ENVIADO!");
        return true;
      }
      noProgressCount = 0;
      continue;
    }

    const sigBtn = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('[role="button"], button, input[type="submit"], span'));
      return btns.some(b => {
        const txt = (b.innerText || b.value || "").trim().toLowerCase();
        return txt === "siguiente" || txt === "next" || txt.includes("siguiente");
      });
    }).catch(() => false);
    if (sigBtn) {
      if (pageNum && pageNum.current === lastPageNum) {
        noProgressCount++;
        if (noProgressCount >= 3) {
          console.log("  [VA] Misma pagina tras 3 intentos de Siguiente, usando IA...");
          noProgressCount = 0;
        } else {
          console.log("  [VA] Click Siguiente (pagina " + pageNum.current + "/" + pageNum.total + ")...");
          await clickBtn(page, "Siguiente");
          const newPg = await waitForPageTransition(page, pageNum.current);
          if (newPg) {
            lastPageNum = newPg.current;
            noProgressCount = 0;
          } else {
            noProgressCount++;
          }
          continue;
        }
      } else {
        console.log("  [VA] Click Siguiente (pagina " + (pageNum ? pageNum.current + "/" + pageNum.total : "?") + ")...");
        await clickBtn(page, "Siguiente");
        const newPg = await waitForPageTransition(page, pageNum ? pageNum.current : 0);
        if (newPg) {
          lastPageNum = newPg.current;
          noProgressCount = 0;
        } else {
          console.log("  [VA] No avanzo - verificando errores de validacion...");
          const errMsg = await page.evaluate(() => {
            const err = document.querySelector('[role="alert"], [aria-live="assertive"]');
            if (err) return err.textContent.substring(0, 200);
            const req = document.querySelector('[role="listitem"] .NPEfkd');
            if (req) {
              const h = req.closest('[role="listitem"]')?.querySelector('[role="heading"]');
              return "campo requerido: " + (h ? h.textContent.trim() : "?");
            }
            return "";
          }).catch(() => "");
          if (errMsg) console.log("  [VA] Error: " + errMsg);
          noProgressCount++;
        }
        continue;
      }
    }

    noProgressCount++;
    if (noProgressCount >= 5) {
      console.log("\n  [VA] Atascado. Activando Supervisor IA para recuperacion...");

      let aiRecovered = false;
      for (let aiAttempt = 0; aiAttempt < 3; aiAttempt++) {
        if (aiAttempt > 0) await delay(2000);
        const aiResponse = await askAI(page, "Formulario atascado, no hay botones Siguiente/Enviar visibles.");
        if (aiResponse) {
          aiRecovered = await executeAIAction(page, aiResponse);
          if (aiRecovered) {
            console.log("  [VA] IA recupero el avance exitosamente!\n");
            noProgressCount = 0;
            break;
          }
        }
      }

      if (!aiRecovered) {
        console.log("\n  [ALERTA DEL AGENTE] La IA no pudo destrabar la pagina.");
        console.log("  Por favor, ve a la ventana de Chrome y revisa que falta.");
        console.log("  Llena lo que falte o avanza manualmente.");
        console.log("  Presiona [ENTER] en esta consola cuando estes listo.");

        await new Promise(resolve => {
          const stdin = process.stdin;
          stdin.resume();
          stdin.once('data', () => {
            stdin.pause();
            resolve();
          });
        });

        console.log("  [VA] Retomando control...\n");
        noProgressCount = 0;
      }
    }
  }
  return false;
}

module.exports = { agentLoop };
