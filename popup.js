document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('alertForm');
    const alertsList = document.getElementById('alertsList');
    const statusDiv = document.getElementById('status');
    
    // Charger les alertes existantes
    loadAlerts();
    updateStatus();
    
    // Gestionnaire de soumission du formulaire
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        addAlert();
    });
    
    function addAlert() {
        const alertData = {
            id: Date.now().toString(),
            marque: document.getElementById('marque').value,
            modele: document.getElementById('modele').value,
            prixMin: document.getElementById('prixMin').value,
            prixMax: document.getElementById('prixMax').value,
            kmMin: document.getElementById('kmMin').value,
            kmMax: document.getElementById('kmMax').value,
            anneeMin: document.getElementById('anneeMin').value,
            anneeMax: document.getElementById('anneeMax').value,
            localisation: document.getElementById('localisation').value,
            rayon: document.getElementById('rayon').value,
            notificationSound: document.getElementById('notificationSound').checked,
            dateCreation: new Date().toISOString(),
            active: true
        };
        
        // Sauvegarder l'alerte
        chrome.storage.local.get(['alerts'], function(result) {
            const alerts = result.alerts || [];
            alerts.push(alertData);
            
            chrome.storage.local.set({ alerts: alerts }, function() {
                loadAlerts();
                updateStatus();
                resetForm();
                
                // Démarrer la surveillance
                chrome.runtime.sendMessage({
                    action: 'startMonitoring',
                    alerts: alerts
                });
            });
        });
    }
    
    function loadAlerts() {
        chrome.storage.local.get(['alerts'], function(result) {
            const alerts = result.alerts || [];
            alertsList.innerHTML = '';
            
            alerts.forEach(alert => {
                const alertElement = createAlertElement(alert);
                alertsList.appendChild(alertElement);
            });
        });
    }
    
    function createAlertElement(alert) {
        const div = document.createElement('div');
        div.className = 'alert-item';
        
        let description = '';
        if (alert.marque) description += `${alert.marque} `;
        if (alert.modele) description += `${alert.modele} `;
        if (alert.prixMin || alert.prixMax) {
            description += `(${alert.prixMin || '0'}€ - ${alert.prixMax || '∞'}€) `;
        }
        if (alert.localisation) description += `près de ${alert.localisation}`;
        
        div.innerHTML = `
            <button class="remove-btn" onclick="removeAlert('${alert.id}')">×</button>
            <div><strong>${description || 'Toutes voitures'}</strong></div>
            <div style="margin-top: 5px; opacity: 0.8;">
                ${alert.kmMin || '0'} - ${alert.kmMax || '∞'} km | 
                ${alert.anneeMin || '0'} - ${alert.anneeMax || '∞'}
            </div>
            <div style="margin-top: 5px; font-size: 11px; opacity: 0.7;">
                Créée le ${new Date(alert.dateCreation).toLocaleDateString()}
            </div>
        `;
        
        return div;
    }
    
    function resetForm() {
        form.reset();
    }
    
    function updateStatus() {
        chrome.storage.local.get(['alerts'], function(result) {
            const alerts = result.alerts || [];
            const activeAlerts = alerts.filter(a => a.active);
            
            if (activeAlerts.length > 0) {
                statusDiv.className = 'status active';
                statusDiv.textContent = `${activeAlerts.length} alerte(s) active(s)`;
            } else {
                statusDiv.className = 'status inactive';
                statusDiv.textContent = 'Aucune alerte active';
            }
        });
    }
    
    // Fonction globale pour supprimer une alerte
    window.removeAlert = function(alertId) {
        chrome.storage.local.get(['alerts'], function(result) {
            const alerts = result.alerts || [];
            const updatedAlerts = alerts.filter(alert => alert.id !== alertId);
            
            chrome.storage.local.set({ alerts: updatedAlerts }, function() {
                loadAlerts();
                updateStatus();
                
                // Mettre à jour la surveillance
                chrome.runtime.sendMessage({
                    action: 'startMonitoring',
                    alerts: updatedAlerts
                });
            });
        });
    };
});