# Architecture Document — SolidarityBAC & Platform Resilience Ecosystem (IJIDeals Solidarity)

**Statut:** Spécification d'Architecture Canonique
**Date:** 22 août 2026
**Auteurs:** Alex Osterwalder, Sangeet Paul Choudary & Équipe Architecture MosaiX
**Plateforme Hôte:** IJIDeals
**Runtime Core:** MosaiX Runtime Kernel
**Conformité:** Constitution MosaiX (Lois 1 à 7), ADR-0001, ADR-0002, ADR-0012, PRD-0009

---

## 1. Vision et Principe Fondateur

> **Règle d'or de l'Architecture:**
> *« SolidarityBAC et AlertBAC possèdent la sémantique métier respective de la coordination de la solidarité citoyenne et de la sécurité publique/alerte d'urgence, mais ne possèdent JAMAIS les capacités d'infrastructure ou de domaine transverse appartenant aux autres BACs de MosaiX. »*

IJIDeals Solidarity est une **infrastructure numérique universelle de coordination de la solidarité et de résilience territoriale**. Il ne s'agit ni d'une simple cagnotte, ni d'un fil d'actualité social, mais d'une **couche d'orchestration traçable et d'alerte certifiée** transformant les signaux d'urgence et la bonne volonté citoyenne en réseau d'aide efficace et coordonné lors de crises (incendies, inondations, séismes, vagues de froid, accidents industriels).

### Boucle Complexe de Résilience Territoriale
```text
[ DÉTECTION / SIGNALEMENT ]
            │
            ▼
     [ IncidentBAC ]
      │           │
      │           ▼
      │      [ AlertBAC (IJIDeals Alert / CAP v1.2) ]
      │           │
      │           ▼
      │      [ Alerte / Ordre d'Évacuation Géofencé ]
      │           │
      │           ├─────────────────────────┐
      │           ▼                         ▼
      │    (Je suis en sécurité)    (J'ai besoin d'aide)
      │                                     │
      ▼                                     ▼
 [ SolidarityBAC ] ◄────────────────────────┘
      │
      ▼
 [ Allocation & Matching Engine ]
      │
      ▼
 [ LogisticsBAC / Mission Dispatch ]
      │
      ▼
 [ Réception Hub / Refuge (Shelter) ]
      │
      ▼
 [ Distribution aux Bénéficiaires ]
      │
      ▼
 [ Preuve & Traçabilité (Audit Trail) ]
```

---

## 2. Architecture Multi-BAC & Frontières Strictes

Conformément à la **Loi 7 de la Constitution MosaiX** (*One Bounded Context = One Application*), la résilience est découpée en Bounded Application Contexts autonomes et spécialisés :

```text
                                 MosaiX Ecosystem
                                         │
                   ┌─────────────────────┼─────────────────────┐
                   │                     │                     │
              IncidentBAC             AlertBAC           SolidarityBAC
                   │                     │                     │
         (Déclaration/Statut)    (Sécurité Publique/   (Besoins, Ressources,
                                  Alertes Actionnables)  Missions, Allocations)
                   │                     │                     │
                   └─────────────────────┼─────────────────────┘
                                         │
                                         ▼
                                   LogisticsBAC
                                         │
                             (Transport, Convois & Hubs)
```

### Matrice de Responsabilités et Découpage Fonctionnel

| BAC / Domaine | Responsabilité Exclusive | Ne gère JAMAIS |
|---|---|---|
| **`IncidentBAC`** | Cycle de vie de la crise (`DECLARED` ➔ `ACTIVE` ➔ `RESOLVED`), zones affectées, gravité. | Ni la diffusion d'alertes, ni les dons ou missions logistiques. |
| **`AlertBAC` (`IJIDeals Alert`)** | Création, validation (CAP v1.2), ciblage géographique et diffusion multi-canal d'alertes d'urgence. | Les comptes utilisateurs, les stocks de matériel ou les transports. |
| **`SolidarityBAC`** | Sémantique des besoins (`Need`), ressources (`Resource`), dons (`Donation`), allocation et distribution. | L'authentification, la géolocalisation brute ou l'envoi direct de SMS. |
| **`LogisticsBAC`** | Exécution des `Missions`, mouvements de véhicules, gestion physique des `Hubs` et refuges. | La décision métier de priorité d'urgence ou la création d'alertes. |

---

## 3. Subdomain Taxonomy & Agrégats du Domaine

### 3.1 `AlertAggregate` (`AlertBAC` — Conforme OASIS CAP v1.2)
- **Identifiant:** `AlertId` (ex: `ALT-2026-0042`)
- **Attributs:** `id`, `incidentId`, `identifier`, `sender`, `sentAt`, `status` (`ACTUAL`, `EXERCISE`, `TEST`, `CANCEL`), `msgType` (`ALERT`, `UPDATE`, `CANCEL`, `ACK`), `scope` (`PUBLIC`, `RESTRICTED`), `category` (`FIRE`, `GEO`, `SAFETY`, `RESCUE`, `HEALTH`, `MET`), `urgency` (`IMMEDIATE`, `EXPECTED`, `FUTURE`), `severity` (`EXTREME`, `SEVERE`, `MODERATE`, `MINOR`), `certainty` (`OBSERVED`, `LIKELY`, `POSSIBLE`), `headline`, `description`, `instruction`, `affectedAreaPolygon`, `exclusionArea`, `safeRoutes`, `shelters`, `issuerAuthorityLevel`, `version`, `referencedAlertId`
- **Distinction Sémantique:** `Warning` (Information de danger) vs `Alert` (Alerte d'urgence) vs `Order` (Instruction officielle d'évacuation).

### 3.2 `IncidentAggregate` (`IncidentBAC`)
- **Identifiant:** `IncidentId` (ex: `INC-2026-0001`)
- **Attributs:** `id`, `code`, `title`, `description`, `type` (`FIRE`, `FLOOD`, `EARTHQUAKE`, `STORM`, `COLD_WAVE`, `LANDSLIDE`, `INDUSTRIAL_ACCIDENT`, `OTHER`), `status`, `severityLevel`, `geoZone`, `startDate`, `endDate`, `coordinatingOrgId`

### 3.3 `NeedAggregate` (`SolidarityBAC`)
- **Identifiant:** `NeedId` (ex: `NEED-9842`)
- **Attributs:** `id`, `incidentId`, `alertId`, `requesterId`, `type` (`FOOD`, `WATER`, `CLOTHING`, `BLANKET`, `MEDICAL`, `HYGIENE`, `BABY`, `SHELTER`, `TRANSPORT`, `HOUSING`, `EQUIPMENT`, `FINANCIAL`, `VOLUNTEER`), `quantityRequired`, `quantitySatisfied`, `urgency` (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`), `affectedPeopleCount`, `geoPoint`, `status`

### 3.4 `DonationAggregate` & `ResourceAggregate` (`SolidarityBAC`)
- **`DonationId`:** Acte de contribution déclaratif (produits, argent, transport, hébergement, compétences, temps).
- **`ResourceId`:** Stock physique ou capacité logistique réelle et vérifiée, disponible dans un `Hub`.

### 3.5 `HubAggregate` / Refuge (`SolidarityBAC` & `LogisticsBAC`)
- **Identifiant:** `HubId` / `ShelterId`
- **Attributs:** `id`, `spaceId`, `name`, `type` (`WAREHOUSE`, `COLLECTION_CENTER`, `DISTRIBUTION_CENTER`, `SHELTER`), `capacityM3`, `maxOccupancyPeople`, `currentOccupancyPeople`, `geoPoint`, `operatingHours`, `acceptedResourceTypes`, `trustLevel`

### 3.6 `MissionAggregate` & `DistributionAggregate`
- **Workflow de Mission:** `CREATED` ➔ `ASSIGNED` ➔ `READY` ➔ `IN_TRANSIT` ➔ `ARRIVED` ➔ `RECEIVED` ➔ `DISTRIBUTED` ➔ `COMPLETED`
- **Distribution:** Génère une preuve d'impact (`ProofOfDelivery`) enregistrée dans la piste d'audit.

---

## 4. Spécification des Événements MosaiX (Single Ownership Rule)

### Événements `alert.*` (Propriété exclusive de `AlertBAC`)
```typescript
// alert.emergency.issued (CAP v1.2 Payload Envelope)
export interface EmergencyAlertIssuedEvent {
  eventId: string;
  occurredAt: string;
  tenantId: string;
  payload: {
    alertId: string;
    incidentId: string;
    msgType: 'ALERT' | 'UPDATE' | 'CANCEL';
    severity: 'EXTREME' | 'SEVERE' | 'MODERATE';
    headline: string;
    instruction: string;
    affectedAreaPolygon: Array<{ latitude: number; longitude: number }>;
    issuer: { id: string; organization: string; authorityLevel: number };
    channels: Array<'PUSH' | 'SMS' | 'CELL_BROADCAST' | 'WEB'>;
  };
}

// alert.safety_status.responded
export interface SafetyStatusRespondedEvent {
  eventId: string;
  occurredAt: string;
  tenantId: string;
  payload: {
    alertId: string;
    userId: string;
    status: 'SAFE' | 'NEED_HELP';
    geoPoint: { latitude: number; longitude: number };
    generatedNeedId?: string;
  };
}
```

### Événements `solidarity.*` (Propriété exclusive de `SolidarityBAC`)
1. `solidarity.need.created` / `solidarity.need.priority_changed` / `solidarity.need.satisfied`
2. `solidarity.donation.created` / `solidarity.donation.verified`
3. `solidarity.resource.available` / `solidarity.resource.allocated`
4. `solidarity.mission.created` / `solidarity.mission.started` / `solidarity.mission.completed`
5. `solidarity.distribution.confirmed`

---

## 5. Moteur d'Alerte, Hiérarchie d'Autorité & Citadelle

### 5.1 Niveaux d'Autorité des Émetteurs d'Alertes
- **Niveau 0 (Citoyen):** Peut émettre un *Signalement* de danger local (nécessite modération).
- **Niveau 1 (Coordinateur Vérifié):** Peut publier des informations opérationnelles locales.
- **Niveau 2 (Organisation Vérifiée):** Associations & ONGs agrées.
- **Niveau 3 (Autorité Habilitée):** Protection Civile, Préfecture, Maire (Ordres d'évacuation).
- **Niveau 4 (Autorité Nationale):** Alertes critiques nationales.

### 5.2 Règle du Double Contrôle Citadelle (Two-Person Rule)
Pour prévenir toute fausse alerte ou compromission de compte lors de l'émission d'un ordre d'évacuation critique (`🔴 ÉVACUATION IMMÉDIATE` à grande échelle) :
- **Politique Citadelle:** La création d'un événement `alert.emergency.issued` de sévérité `EXTREME` exige une validation signée cryptographiquement par au moins **deux autorités autorisées** (Émetteur + Confirmateur).

```text
[ Autorité #1 : Émission Ordre Évacuation ]
                     │
                     ▼
       [ En attente de validation ]
                     │
[ Autorité #2 : Confirmation Cryptographique ]
                     │
                     ▼
          [ Event Bus : CAP v1.2 ]
                     │
  ┌──────────────────┼──────────────────┐
  ▼                  ▼                  ▼
Push App          SMS LBS        Cell Broadcast
```

---

## 6. Sémantique de l'Alerte Actionnable & Interaction Citoyenne

Lorsqu'une alerte géofencée est diffusée aux téléphones dans la zone affectée, l'interface propose des actions immédiates :

```text
🔴 ÉVACUATION IMMÉDIATE — Sectorisation El Aouana
Motif: Progression rapide du front d'incendie (RN43)

[ 🧭 Voir l'itinéraire d'évacuation recommandé ]
[ 🏥 Voir les refuges (Shelters) disponibles ]

┌─────────────────────────────────────────────────────────┐
│  [ 🟢 Je suis en sécurité ]   [ 🆘 J'ai besoin d'aide ] │
└─────────────────────────────────────────────────────────┘
```

Si le citoyen clique sur **`🆘 J'ai besoin d'aide`** :
1. Un événement `alert.safety_status.responded` est émis.
2. `SolidarityBAC` crée immédiatement un `Need` critique (Hébergement, Transport ou Médical).
3. Le **Matching Engine** alloue en priorité les ressources des Hubs/Refuges non saturés.

---

## 7. Moteurs d'Allocation, Routing & Protection des Données

### 7.1 Dynamic Shelter Routing
Si le refuge `Shelter A` atteint 98% de sa capacité maximale :
- Le moteur de routage met à jour la carte opérationnelle et redirige automatiquement les convois et évacués vers `Shelter B` (61% de capacité).

### 7.2 Moteur de Matching ($MATCH\_SCORE$)
$$\text{MATCH SCORE} = w_1 \cdot U + w_2 \cdot P + w_3 \cdot C + w_4 \cdot A + w_5 \cdot T + w_6 \cdot B$$
- Prends en compte le poids d'urgence $U$, la proximité $P$, la compatibilité matériel $C$, la fenêtre de disponibilité $A$, la faisabilité du transport $T$, et l'indice de vulnérabilité de la zone $B$.

### 7.3 Protection de la Vie Privée des Bénéficiaires
- Floutage géographique public (rayon de 1 à 3 km sur les cartes ouvertes).
- Pseudonymisation stricte des identités des sinistrés via hashes anonymes déchiffrables uniquement par le coordinateur de distribution locale muni d'un jeton Citadelle contextuel.

---

## 8. Abstraction Multi-Canal (Alert Delivery Providers)

`AlertBAC` abstrait la diffusion multi-canal via des adaptateurs interchangeables :

```text
                     AlertBAC
                        │
       ┌────────────────┼────────────────┐
       ▼                ▼                ▼
PushProvider       SMSProvider    CellBroadcastProvider
(IJIDeals App)    (SMS LBS Geo)   (Réseau Mobile 3PP)
```

---

## 9. Indicateurs de Performance (KPIs d'Impact)

| KPI Canonique | Description | Cible |
|---|---|---|
| **Alert Dissemination Latency** | Délai entre la validation d'une alerte et sa réception sur les canaux. | < 5 secondes |
| **Time to Fulfillment (TTF)** | Temps écoulé entre la création d'un besoin critique et sa satisfaction. | < 6 heures |
| **Aid Coverage Ratio** | Ratio des besoins satisfaits par rapport aux besoins exprimés. | > 90% |
| **Critical Need Response Time** | Temps moyen de réponse à un besoin d'urgence `CRITICAL`. | < 30 minutes |
| **Resource Utilization Rate** | Proportion des dons et ressources distribués sans gaspillage. | > 95% |
| **Traceability Rate** | Pourcentage de dons dont la chaîne complète est vérifiée. | 100% |

---

## 10. Scénario MVP (Cas d'Usage Incendies de Jijel)

1. **Déclaration de Crise:** Le Centre Opérationnel déclare l'incident `INC-2026-0001` (*Incendies de Jijel*).
2. **Émission d'Alerte Actionnable:** Deux autorités valident l'alerte `ALT-2026-0042` (`🔴 ÉVACUATION IMMÉDIATE`, Zone El Aouana).
3. **Réponse Citoyenne:** Un citoyen clique sur `🆘 J'ai besoin d'aide` (Hébergement 4 personnes).
4. **Création du Besoin & Matching:** `SolidarityBAC` génère `Need #9842` et identifie une ressource dans le `Hub Alger` et un refuge disponible (`Shelter Bèjaia`).
5. **Mission & Logistics:** Un transporteur bénévole est affecté à la `Mission #4521` pour convoyer le matériel et sécuriser la zone.
6. **Distribution & Clôture:** Réception scannée par QR Code (`solidarity.mission.arrived`), confirmation de la distribution (`solidarity.distribution.confirmed`), et mise à jour de la timeline d'alerte (`🟢 EVACUATION TERMINÉE`).
