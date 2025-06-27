// Script de contenu pour interagir avec les pages des sites d'annonces
console.log('Extension Alertes Voitures - Script de contenu chargé');

// Fonction pour extraire les données d'annonces de la page actuelle
function extractAnnouncesFromPage() {
    const currentUrl = window.location.href;
    let annonces = [];
    
    if (currentUrl.includes('leboncoin.fr')) {
        annonces = extractLeBonCoinAnnonces();
    } else if (currentUrl.includes('lacentrale.fr')) {
        annonces = extractLaCentraleAnnonces();
    } else if (currentUrl.includes('paruvendu.fr')) {
        annonces = extractParuVenduAnnonces();
    } else if (currentUrl.includes('argus.fr')) {
        annonces = extractArgusAnnonces();
    }
    
    return annonces;
}

function extractLeBonCoinAnnonces() {
    const annonces = [];
    
    // Sélecteurs mis à jour pour Le Bon Coin
    const annonceElements = document.querySelectorAll('[data-testid="adCard"], .styles_adCard__2Z2rP, ._1noem');
    
    annonceElements.forEach(element => {
        try {
            const titre = element.querySelector('[data-testid="adTitle"], .styles_adTitle__1K5pX, h2 a')?.textContent?.trim();
            const prix = element.querySelector('[data-testid="adPrice"], .styles_adPrice__1gP7j, ._1f4ay')?.textContent?.trim();
            const localisation = element.querySelector('[data-testid="adLocation"], .styles_adLocation__1ySef, ._1ArK5')?.textContent?.trim();
            const lien = element.querySelector('a')?.href;
            const image = element.querySelector('img')?.src;
            
            if (titre && prix) {
                annonces.push({
                    titre,
                    prix,
                    localisation: localisation || '',
                    lien: lien ? (lien.startsWith('http') ? lien : 'https://www.leboncoin.fr' + lien) : '',
                    image: image || '',
                    site: 'Le Bon Coin',
                    timestamp: Date.now()
                });
            }
        } catch (error) {
            console.error('Erreur extraction Le Bon Coin:', error);
        }
    });
    
    return annonces;
}

function extractLaCentraleAnnonces() {
    const annonces = [];
    
    // Sélecteurs pour La Centrale
    const annonceElements = document.querySelectorAll('.searchCard, .cardAd, .AdCard');
    
    annonceElements.forEach(element => {
        try {
            const titre = element.querySelector('.searchCard-title, .cardAd-title, .AdCard-title, h3 a')?.textContent?.trim();
            const prix = element.querySelector('.searchCard-price, .cardAd-price, .AdCard-price, .price')?.textContent?.trim();
            const localisation = element.querySelector('.searchCard-location, .cardAd-location, .AdCard-location, .location')?.textContent?.trim();
            const lien = element.querySelector('a')?.href;
            const image = element.querySelector('img')?.src;
            const kilometrage = element.querySelector('.searchCard-criteriaList, .cardAd-criteriaList')?.textContent?.trim();
            
            if (titre && prix) {
                annonces.push({
                    titre,
                    prix,
                    localisation: localisation || '',
                    lien: lien ? (lien.startsWith('http') ? lien : 'https://www.lacentrale.fr' + lien) : '',
                    image: image || '',
                    kilometrage: kilometrage || '',
                    site: 'La Centrale',
                    timestamp: Date.now()
                });
            }
        } catch (error) {
            console.error('Erreur extraction La Centrale:', error);
        }
    });
    
    return annonces;
}

function extractParuVenduAnnonces() {
    const annonces = [];
    
    // Sélecteurs pour ParuVendu
    const annonceElements = document.querySelectorAll('.annonceItem, .listing-item, .ad-item');
    
    annonceElements.forEach(element => {
        try {
            const titre = element.querySelector('.annonceItem-title, .listing-title, .ad-title, h3 a')?.textContent?.trim();
            const prix = element.querySelector('.annonceItem-price, .listing-price, .ad-price, .price')?.textContent?.trim();
            const localisation = element.querySelector('.annonceItem-location, .listing-location, .ad-location')?.textContent?.trim();
            const lien = element.querySelector('a')?.href;
            const image = element.querySelector('img')?.src;
            
            if (titre && prix) {
                annonces.push({
                    titre,
                    prix,
                    localisation: localisation || '',
                    lien: lien ? (lien.startsWith('http') ? lien : 'https://www.paruvendu.fr' + lien) : '',
                    image: image || '',
                    site: 'ParuVendu',
                    timestamp: Date.now()
                });
            }
        } catch (error) {
            console.error('Erreur extraction ParuVendu:', error);
        }
    });
    
    return annonces;
}

function extractArgusAnnonces() {
    const annonces = [];
    
    // Sélecteurs pour L'Argus
    const annonceElements = document.querySelectorAll('.listing-card, .car-card, '.ad-card');
    
    annonceElements.forEach(element => {
        try {
            const titre = element.querySelector('.listing-card-title, .car-title, .ad-title, h3')?.textContent?.trim();
            const prix = element.querySelector('.listing-card-price, .car-price, .ad-price, .price')?.textContent?.trim();
            const localisation = element.querySelector('.listing-card-location, .car-location, .ad-location')?.textContent?.trim();
            const lien = element.querySelector('a')?.href;
            const image = element.querySelector('img')?.src;
            
            if (titre && prix) {
                annonces.push({
                    titre,
                    prix,
                    localisation: localisation || '',
                    lien: lien ? (lien.startsWith('http') ? lien : 'https://www.largus.fr' + lien) : '',
                    image: image || '',
                    site: 'L\'Argus',
                    timestamp: Date.now()
                });
            }
        } catch (error) {
            console.error('Erreur extraction L\'Argus:', error);
        }
    });
    
    return annonces;
}

// Observer les changements sur la page pour détecter les nouvelles annonces
let lastAnnouncesCount = 0;
const observer = new MutationObserver(() => {
    const annonces = extractAnnouncesFromPage();
    
    if (annonces.length > lastAnnouncesCount) {
        console.log(`${annonces.length - lastAnnouncesCount} nouvelles annonces détectées`);
        
        // Envoyer les nouvelles annonces au service worker
        chrome.runtime.sendMessage({
            action: 'newAnnouncesDetected',
            annonces: annonces.slice(lastAnnouncesCount),
            url: window.location.href
        });
    }
    
    lastAnnouncesCount = annonces.length;
});

// Commencer l'observation
observer.observe(document.body, {
    childList: true,
    subtree: true
});

// Écouter les messages du service worker
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'extractAnnonces') {
        const annonces = extractAnnouncesFromPage();
        
        // Filtrer les annonces qui correspondent aux critères de l'alerte
        const filteredAnnonces = annonces.filter(annonce => 
            matchesAlert(annonce, message.alert)
        );
        
        sendResponse({ 
            annonces: filteredAnnonces,
            totalFound: annonces.length,
            site: message.site 
        });
        return true; // Indiquer que la réponse sera asynchrone
    }
});

// Fonction utilitaire pour normaliser les prix
function normalizePrice(priceString) {
    if (!priceString) return 0;
    
    // Supprimer tous les caractères non numériques sauf les points et virgules
    const cleanPrice = priceString.replace(/[^\d.,]/g, '');
    
    // Convertir en nombre
    const price = parseFloat(cleanPrice.replace(',', '.'));
    
    return isNaN(price) ? 0 : price;
}

// Fonction utilitaire pour normaliser le kilométrage
function normalizeKilometrage(kmString) {
    if (!kmString) return 0;
    
    const cleanKm = kmString.replace(/[^\d]/g, '');
    const km = parseInt(cleanKm);
    
    return isNaN(km) ? 0 : km;
}

// Fonction pour vérifier si une annonce correspond aux critères
function matchesAlert(annonce, alert) {
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
    
    // Vérifier le kilométrage (si disponible)
    if (annonce.kilometrage) {
        const km = normalizeKilometrage(annonce.kilometrage);
        if (alert.kmMin && km < parseInt(alert.kmMin)) {
            return false;
        }
        if (alert.kmMax && km > parseInt(alert.kmMax)) {
            return false;
        }
    }
    
    // Vérifier la localisation
    if (alert.localisation && annonce.localisation) {
        if (!annonce.localisation.toLowerCase().includes(alert.localisation.toLowerCase())) {
            return false;
        }
    }
    
    return true;
}

// Ajouter un indicateur visuel sur la page
function addExtensionIndicator() {
    if (document.getElementById('car-alert-indicator')) return;
    
    const indicator = document.createElement('div');
    indicator.id = 'car-alert-indicator';
    indicator.innerHTML = '🚗 Alertes Voitures Actives';
    indicator.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 8px 12px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: bold;
        z-index: 10000;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        animation: fadeIn 0.5s ease-in;
    `;
    
    // Ajouter l'animation CSS
    const style = document.createElement('style');
    style.textContent = `
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-20px); }
            to { opacity: 1; transform: translateY(0); }
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(indicator);
    
    // Masquer l'indicateur après 3 secondes
    setTimeout(() => {
        indicator.style.animation = 'fadeOut 0.5s ease-out forwards';
        setTimeout(() => indicator.remove(), 500);
    }, 3000);
    
    // Ajouter l'animation de sortie
    style.textContent += `
        @keyframes fadeOut {
            from { opacity: 1; transform: translateY(0); }
            to { opacity: 0; transform: translateY(-20px); }
        }
    `;
}

// Vérifier si des alertes sont actives et afficher l'indicateur
chrome.storage.local.get(['alerts'], (result) => {
    const alerts = result.alerts || [];
    const activeAlerts = alerts.filter(a => a.active);
    
    if (activeAlerts.length > 0) {
        addExtensionIndicator();
    }
});

// Initialisation
console.log('Extension Alertes Voitures - Surveillance active sur', window.location.hostname);