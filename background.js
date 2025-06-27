// Service Worker pour la surveillance en arrière-plan
let monitoringInterval;

// Écouter les messages du popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'startMonitoring') {
        startMonitoring(message.alerts);
    } else if (message.action === 'stopMonitoring') {
        stopMonitoring();
    }
});

// Démarrer la surveillance au démarrage de l'extension
chrome.runtime.onStartup.addListener(() => {
    chrome.storage.local.get(['alerts'], (result) => {
        if (result.alerts && result.alerts.length > 0) {
            startMonitoring(result.alerts);
        }
    });
});

// Démarrer la surveillance lors de l'installation
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.get(['alerts'], (result) => {
        if (result.alerts && result.alerts.length > 0) {
            startMonitoring(result.alerts);
        }
    });
});

function startMonitoring(alerts) {
    stopMonitoring(); // Arrêter la surveillance existante
    
    if (!alerts || alerts.length === 0) return;
    
    console.log('Démarrage de la surveillance pour', alerts.length, 'alertes');
    
    // Créer une alarme pour vérifier toutes les 5 minutes
    chrome.alarms.create('checkNewCars', { periodInMinutes: 5 });
    
    // Vérification immédiate
    checkNewCars(alerts);
}

function stopMonitoring() {
    chrome.alarms.clear('checkNewCars');
    console.log('Surveillance arrêtée');
}

// Écouter les alarmes
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'checkNewCars') {
        chrome.storage.local.get(['alerts'], (result) => {
            if (result.alerts && result.alerts.length > 0) {
                checkNewCars(result.alerts);
            }
        });
    }
});

async function checkNewCars(alerts) {
    console.log('Vérification des nouvelles annonces...');
    
    for (const alert of alerts) {
        if (!alert.active) continue;
        
        try {
            // Vérifier sur tous les sites supportés
            await checkSiteForAlert(alert, 'leboncoin.fr');
            await checkSiteForAlert(alert, 'lacentrale.fr');
            await checkSiteForAlert(alert, 'paruvendu.fr');
            await checkSiteForAlert(alert, 'largus.fr');
            
            // Délai entre les vérifications
            await sleep(1000);
            
        } catch (error) {
            console.error('Erreur lors de la vérification:', error);
        }
    }
}

async function checkSiteForAlert(alert, site) {
    const searchUrl = buildSearchUrl(alert, site);
    
    try {
        // Créer un onglet en arrière-plan pour scraper
        const tab = await chrome.tabs.create({
            url: searchUrl,
            active: false
        });
        
        // Attendre que la page se charge complètement
        await waitForTabToLoad(tab.id);
        
        // Injecter le content script manuellement
        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
        });
        
        // Attendre que le content script s'initialise
        await sleep(2000);
        
        try {
            // Envoyer le message au content script
            const results = await chrome.tabs.sendMessage(tab.id, {
                action: 'extractAnnonces',
                alert: alert,
                site: site
            });
            
            if (results && results.annonces && results.annonces.length > 0) {
                await processNewAnnonces(results.annonces, alert, site);
            }
        } catch (messageError) {
            console.log(`Content script non disponible sur ${site}, extraction directe...`);
            // Fallback: extraire directement via executeScript
            await extractAnnoncesDirect(tab.id, alert, site);
        }
        
        // Fermer l'onglet
        await chrome.tabs.remove(tab.id);
        
    } catch (error) {
        console.error(`Erreur ${site}:`, error);
    }
}

// Fonction pour attendre que l'onglet soit complètement chargé
function waitForTabToLoad(tabId) {
    return new Promise((resolve) => {
        const listener = (updatedTabId, changeInfo, tab) => {
            if (updatedTabId === tabId && changeInfo.status === 'complete') {
                chrome.tabs.onUpdated.removeListener(listener);
                resolve();
            }
        };
        chrome.tabs.onUpdated.addListener(listener);
        
        // Timeout de sécurité
        setTimeout(() => {
            chrome.tabs.onUpdated.removeListener(listener);
            resolve();
        }, 10000);
    });
}

// Extraction directe si le content script ne répond pas
async function extractAnnoncesDirect(tabId, alert, site) {
    try {
        const results = await chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: extractAnnoncesFromPage,
            args: [site]
        });
        
        if (results && results[0] && results[0].result) {
            const annonces = results[0].result;
            if (annonces.length > 0) {
                await processNewAnnonces(annonces, alert, site);
            }
        }
    } catch (error) {
        console.error(`Erreur lors de l'extraction directe pour ${site}:`, error);
    }
}

// Fonction d'extraction qui sera injectée dans la page
function extractAnnoncesFromPage(site) {
    const annonces = [];
    
    try {
        if (site === 'leboncoin.fr') {
            const elements = document.querySelectorAll('[data-qa-id="aditem_container"]');
            elements.forEach(el => {
                const titleEl = el.querySelector('[data-qa-id="aditem_title"]');
                const priceEl = el.querySelector('[data-qa-id="aditem_price"]');
                const locationEl = el.querySelector('[data-qa-id="aditem_location"]');
                const linkEl = el.querySelector('a[href]');
                
                if (titleEl && priceEl) {
                    annonces.push({
                        titre: titleEl.textContent?.trim() || '',
                        prix: priceEl.textContent?.trim() || '',
                        localisation: locationEl?.textContent?.trim() || '',
                        lien: linkEl ? 'https://www.leboncoin.fr' + linkEl.getAttribute('href') : '',
                        timestamp: Date.now()
                    });
                }
            });
        } else if (site === 'lacentrale.fr') {
            const elements = document.querySelectorAll('.searchCard');
            elements.forEach(el => {
                const titleEl = el.querySelector('.searchCard-title');
                const priceEl = el.querySelector('.searchCard-price');
                const locationEl = el.querySelector('.searchCard-location');
                const linkEl = el.querySelector('a[href]');
                
                if (titleEl && priceEl) {
                    annonces.push({
                        titre: titleEl.textContent?.trim() || '',
                        prix: priceEl.textContent?.trim() || '',
                        localisation: locationEl?.textContent?.trim() || '',
                        lien: linkEl ? linkEl.href : '',
                        timestamp: Date.now()
                    });
                }
            });
        } else if (site === 'paruvendu.fr') {
            const elements = document.querySelectorAll('.ergov3');
            elements.forEach(el => {
                const titleEl = el.querySelector('.titr');
                const priceEl = el.querySelector('.prix');
                const locationEl = el.querySelector('.loc');
                const linkEl = el.querySelector('a[href]');
                
                if (titleEl && priceEl) {
                    annonces.push({
                        titre: titleEl.textContent?.trim() || '',
                        prix: priceEl.textContent?.trim() || '',
                        localisation: locationEl?.textContent?.trim() || '',
                        lien: linkEl ? linkEl.href : '',
                        timestamp: Date.now()
                    });
                }
            });
        } else if (site === 'largus.fr') {
            const elements = document.querySelectorAll('.result-item');
            elements.forEach(el => {
                const titleEl = el.querySelector('.result-title');
                const priceEl = el.querySelector('.result-price');
                const locationEl = el.querySelector('.result-location');
                const linkEl = el.querySelector('a[href]');
                
                if (titleEl && priceEl) {
                    annonces.push({
                        titre: titleEl.textContent?.trim() || '',
                        prix: priceEl.textContent?.trim() || '',
                        localisation: locationEl?.textContent?.trim() || '',
                        lien: linkEl ? linkEl.href : '',
                        timestamp: Date.now()
                    });
                }
            });
        }
    } catch (error) {
        console.error('Erreur lors de l\'extraction:', error);
    }
    
    return annonces;
}

function buildSearchUrl(alert, site) {
    switch(site) {
        case 'leboncoin.fr':
            return buildLeBonCoinUrl(alert);
        case 'lacentrale.fr':
            return buildLaCentraleUrl(alert);
        case 'paruvendu.fr':
            return buildParuVenduUrl(alert);
        case 'largus.fr':
            return buildArgusUrl(alert);
        default:
            return '';
    }
}

function buildLeBonCoinUrl(alert) {
    let url = 'https://www.leboncoin.fr/recherche?category=2&';
    
    const params = new URLSearchParams();
    
    if (alert.marque) params.append('brand', alert.marque);
    if (alert.modele) params.append('model', alert.modele);
    if (alert.prixMin) params.append('price_min', alert.prixMin);
    if (alert.prixMax) params.append('price_max', alert.prixMax);
    if (alert.kmMin) params.append('mileage_min', alert.kmMin);
    if (alert.kmMax) params.append('mileage_max', alert.kmMax);
    if (alert.anneeMin) params.append('regdate_min', alert.anneeMin);
    if (alert.anneeMax) params.append('regdate_max', alert.anneeMax);
    if (alert.localisation) params.append('locations', alert.localisation);
    if (alert.rayon) params.append('radius', alert.rayon);
    
    return url + params.toString();
}

function buildLaCentraleUrl(alert) {
    let url = 'https://www.lacentrale.fr/listing?';
    
    const params = new URLSearchParams();
    
    if (alert.marque) params.append('makesModelsCommercialNames', alert.marque);
    if (alert.modele) params.append('makesModelsCommercialNames', alert.marque + ':' + alert.modele);
    if (alert.prixMin) params.append('priceMin', alert.prixMin);
    if (alert.prixMax) params.append('priceMax', alert.prixMax);
    if (alert.kmMin) params.append('mileageMin', alert.kmMin);
    if (alert.kmMax) params.append('mileageMax', alert.kmMax);
    if (alert.anneeMin) params.append('yearMin', alert.anneeMin);
    if (alert.anneeMax) params.append('yearMax', alert.anneeMax);
    if (alert.localisation) params.append('location', alert.localisation);
    if (alert.rayon) params.append('radius', alert.rayon);
    
    return url + params.toString();
}

function buildParuVenduUrl(alert) {
    let url = 'https://www.paruvendu.fr/auto-occasion/';
    
    const params = new URLSearchParams();
    
    if (alert.marque) params.append('ma', alert.marque);
    if (alert.modele) params.append('mo', alert.modele);
    if (alert.prixMin) params.append('px1', alert.prixMin);
    if (alert.prixMax) params.append('px2', alert.prixMax);
    if (alert.kmMin) params.append('km1', alert.kmMin);
    if (alert.kmMax) params.append('km2', alert.kmMax);
    if (alert.anneeMin) params.append('an1', alert.anneeMin);
    if (alert.anneeMax) params.append('an2', alert.anneeMax);
    if (alert.localisation) params.append('lo', alert.localisation);
    
    return url + '?' + params.toString();
}

function buildArgusUrl(alert) {
    let url = 'https://www.largus.fr/cote-voitures-occasion/';
    
    const params = new URLSearchParams();
    
    if (alert.marque) params.append('brand', alert.marque);
    if (alert.modele) params.append('model', alert.modele);
    if (alert.prixMin) params.append('price_min', alert.prixMin);
    if (alert.prixMax) params.append('price_max', alert.prixMax);
    if (alert.kmMin) params.append('mileage_min', alert.kmMin);
    if (alert.kmMax) params.append('mileage_max', alert.kmMax);
    if (alert.anneeMin) params.append('year_min', alert.anneeMin);
    if (alert.anneeMax) params.append('year_max', alert.anneeMax);
    if (alert.localisation) params.append('location', alert.localisation);
    
    return url + '?' + params.toString();
}

async function processNewAnnonces(annonces, alert, siteName) {
    const storageKey = `lastCheck_${alert.id}_${siteName}`;
    
    // Obtenir le timestamp de la dernière vérification
    const result = await chrome.storage.local.get([storageKey]);
    const lastCheck = result[storageKey] || 0;
    const currentTime = Date.now();
    
    let newAnnoncesCount = 0;
    
    for (const annonce of annonces) {
        // Vérifier si l'annonce correspond aux critères et est nouvelle
        if (annonce.timestamp > lastCheck && matchesAlertCriteria(annonce, alert)) {
            newAnnoncesCount++;
            await sendNotification(annonce, alert, siteName);
        }
    }
    
    // Mettre à jour le timestamp de la dernière vérification
    await chrome.storage.local.set({ [storageKey]: currentTime });
    
    if (newAnnoncesCount > 0) {
        console.log(`${newAnnoncesCount} nouvelles annonces trouvées sur ${siteName}`);
    }
}

function matchesAlertCriteria(annonce, alert) {
    // Vérifier la marque
    if (alert.marque && !annonce.titre.toLowerCase().includes(alert.marque.toLowerCase())) {
        return false;
    }
    
    // Vérifier le modèle
    if (alert.modele && !annonce.titre.toLowerCase().includes(alert.modele.toLowerCase())) {
        return false;
    }
    
    // Vérifier le prix
    const prix = normalizePrice(annonce.prix);
    if (alert.prixMin && prix < parseInt(alert.prixMin)) {
        return false;
    }
    if (alert.prixMax && prix > parseInt(alert.prixMax)) {
        return false;
    }
    
    // Vérifier la localisation
    if (alert.localisation && annonce.localisation) {
        if (!annonce.localisation.toLowerCase().includes(alert.localisation.toLowerCase())) {
            return false;
        }
    }
    
    return true;
}

function normalizePrice(priceString) {
    if (!priceString) return 0;
    
    // Supprimer tous les caractères non numériques sauf les points et virgules
    const cleanPrice = priceString.replace(/[^\d.,]/g, '');
    
    // Convertir en nombre
    const price = parseFloat(cleanPrice.replace(',', '.'));
    
    return isNaN(price) ? 0 : price;
}

async function sendNotification(annonceData, alert, siteName) {
    const notificationId = `car_alert_${Date.now()}`;
    
    const notificationOptions = {
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: `🚗 Nouvelle annonce sur ${siteName}`,
        message: `${annonceData.titre}\n${annonceData.prix} - ${annonceData.localisation}`,
        buttons: [
            { title: 'Voir l\'annonce' },
            { title: 'Ignorer' }
        ]
    };
    
    // Créer la notification
    chrome.notifications.create(notificationId, notificationOptions);
    
    // Sauvegarder l'annonce pour référence
    const storageKey = `notification_${notificationId}`;
    await chrome.storage.local.set({
        [storageKey]: {
            annonceData,
            alert,
            siteName
        }
    });
    
    // Jouer un son si demandé
    if (alert.notificationSound) {
        console.log('Notification sonore activée');
    }
}

// Gérer les clics sur les notifications
chrome.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
    if (buttonIndex === 0) { // Voir l'annonce
        const storageKey = `notification_${notificationId}`;
        const result = await chrome.storage.local.get([storageKey]);
        
        if (result[storageKey]) {
            const { annonceData } = result[storageKey];
            chrome.tabs.create({ url: annonceData.lien });
        }
    }
    
    // Supprimer la notification
    chrome.notifications.clear(notificationId);
});

// Gérer les clics sur les notifications
chrome.notifications.onClicked.addListener(async (notificationId) => {
    const storageKey = `notification_${notificationId}`;
    const result = await chrome.storage.local.get([storageKey]);
    
    if (result[storageKey]) {
        const { annonceData } = result[storageKey];
        chrome.tabs.create({ url: annonceData.lien });
    }
    
    chrome.notifications.clear(notificationId);
});

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}