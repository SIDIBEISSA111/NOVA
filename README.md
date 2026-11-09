# NOVA — Expéditions Interstellaires

**En ligne : https://nova-expeditions.vercel.app** · Code source : https://github.com/SIDIBEISSA111/NOVA

Site vitrine d'une agence spatiale fictive. En faisant défiler la page, le visiteur
voyage de la Terre jusqu'à une galaxie lointaine. **Tout est procédural** : aucun
modèle 3D, aucune texture externe, aucun fichier audio. Chaque planète, nuage,
étoile, flamme ou particule est calculé par du code (JavaScript + shaders GLSL écrits à la main).

**Stack** : Vite · Three.js r187 · GSAP 3 (ScrollTrigger) · Lenis · JavaScript en modules, sans framework UI.

```bash
npm install
npm run dev       # développement : http://localhost:5173
npm run build     # production : dossier dist/
npm run preview   # tester le build : http://localhost:4173
```

Paramètres d'URL utiles :

| URL | Effet |
| --- | --- |
| `?q=high` / `?q=medium` / `?q=low` | Force un niveau de qualité (désactive l'adaptation automatique) |
| `?debug` | Affiche dans la console le temps de chaque étape de chargement, et signale les images lentes (`window.__novaSlow`) |
| touche **F** | Compteur d'images/seconde, niveau de qualité, appels de dessin, triangles |

---

## 1. Architecture

```
index.html                 Tout le contenu (sections, formulaire, SEO, Open Graph)
public/                    favicon.svg, fallback.svg (image de secours), og-image.jpg, robots.txt
src/
  main.js                  Point d'entrée : interface d'abord, 3D chargée ensuite
  styles/main.css          Styles, mobile d'abord ; couleurs et polices dans :root
  utils/
    env.js                 Détection : mouvements réduits, tactile, mobile, vrai WebGL 2
    sections.js            Défilement (px) → progression du voyage (0 à 5)
  ui/                      Interface HTML, indépendante de la 3D
    scroll.js              Lenis + ScrollTrigger synchronisés sur le ticker GSAP
    title.js               Titre animé lettre par lettre (accessible)
    reveal.js              Fondus d'apparition (IntersectionObserver)
    cards.js               Cartes de mission : inclinaison 3D + reflet au survol
    counters.js            Chiffres clés animés
    form.js                Formulaire : validation accessible + confirmation animée
    progress.js            Barre de voyage + « Distance parcourue »
    cursor.js              Curseur personnalisé (souris uniquement)
    audio.js               Ambiance sonore générée (Web Audio API)
    fps.js                 Compteur FPS (touche F)
    loader.js              Écran de chargement (anneau + pourcentage)
  three/                   Moteur 3D, chargé dynamiquement (fichier séparé)
    index.js               Liste des objets de la scène, dans l'ordre de création
    Experience.js          LE renderer, la scène, la boucle, le redimensionnement, dispose()
    Journey.js             Trajectoire (Catmull-Rom), positions des astres, ambiances
    CameraRig.js           Caméra : suit le scroll, parallaxe souris, cadrage
    Quality.js             Qualité adaptative (haute / moyenne / basse)
    PostFX.js              Post-traitement : bloom, trou noir, passe finale
    objects/               UN fichier par objet de scène
      Nebula.js  Starfield.js  Earth.js  Moon.js  Asteroids.js
      Sun.js  BlackHole.js  Galaxy.js
    shaders/               Tous les shaders GLSL, commentés
      common/noise.glsl    Bruit simplex 3D + fbm, partagé
    utils/                 bakeCube.js (cuisson en cubemap), glsl.js, math.js
```

### Le cycle de vie d'un objet de scène

Chaque fichier de `objects/` exporte une classe avec la même forme :

```js
class MonObjet {
  name = 'monObjet';        // pour le retrouver : experience.get('monObjet')
  range = [1.2, 3.0];       // portion du voyage où il existe (en dehors : ni mis à jour, ni dessiné)
  async init() {}           // facultatif : travail asynchrone (cuisson de textures…)
  update({ time, dt, j, camera, fade }) {}   // à chaque image, si visible
  setQuality(preset) {}     // le système adaptatif a changé de niveau
  setActive(bool) {}        // facultatif : entrée / sortie de sa portion du voyage
  dispose() {}              // libère géométries, matériaux, textures
}
```

Pour ajouter un objet : créer le fichier, puis l'ajouter à `SCENE_STEPS` dans `src/three/index.js`.

### Le voyage

La progression `j` va de 0 à 5 : **0 Terre · 1 Lune · 2 astéroïdes · 3 Soleil · 4 trou noir · 5 galaxie**.
Chaque entier correspond au **centre** d'une section HTML (mesuré au chargement et au redimensionnement).
Dans `Journey.js`, le tableau `KEYFRAMES` décrit, pour chaque étape (et des étapes intermédiaires
0.5, 1.5… qui dessinent les virages) :

- `cam` / `look` : position et cible de la caméra (deux courbes Catmull-Rom « centripètes ») ;
- `frame` : décalage du cadrage pour laisser la place au texte (`setViewOffset`, sans déformer la perspective) ;
- `exposure`, `bloom`, `tint` : l'ambiance lumineuse, interpolée d'une section à l'autre.

Une seule boucle tourne : le **ticker GSAP** (requestAnimationFrame). Lenis, la barre de progression
et le rendu 3D s'y accrochent.

---

## 2. Les effets, un par un

| Effet | Fichiers | Principe |
| --- | --- | --- |
| **Nébuleuse de fond** | `Nebula.js`, `nebula.frag.glsl` | Bruit fractal à déformation de domaine (volutes), calculé **une seule fois** dans une cubemap. Coût par image : une lecture de texture. |
| **Étoiles scintillantes** | `Starfield.js`, `starfield.*.glsl` | 9 000 points sur une sphère qui suit la caméra (étoiles « à l'infini »), 38 % concentrés dans une bande (Voie lactée). Scintillement = produit de deux sinus déphasés. Les plus brillantes dépassent 1.0 et déclenchent le bloom. |
| **Terre** | `Earth.js`, `earthBake.frag.glsl`, `earth.frag.glsl` | Continents = `fbm(position)` seuillé ; couleur selon altitude et latitude (glaces). Cette carte est **cuite** dans une cubemap au chargement. À chaque image : éclairage diffus, reflet du soleil sur l'eau (Blinn-Phong), villes dorées côté nuit, liseré Fresnel. |
| **Nuages** | `cloudsBake.frag.glsl`, `clouds.frag.glsl` | Carte de densité cuite ; à chaque image, un seul bruit animé déforme la lecture → les nuages évoluent. La sphère tourne plus vite que la surface. |
| **Atmosphère** | `atmosphere.frag.glsl` | Pour chaque pixel, distance minimale entre le rayon de vue et le centre de la planète (paramètre d'impact) → halo épais en rasant le bord, teinte dorée au terminateur. Mélange additif. |
| **Lune** | `Moon.js`, `moon.frag.glsl` | 110 cratères (cuvette + rempart) sculptés en JavaScript au chargement ; éclairage Lommel-Seeliger (le disque « plat » de la poussière lunaire). |
| **Astéroïdes** | `Asteroids.js`, `asteroid.*.glsl` | 2 000 rochers en **un seul appel de dessin** (InstancedMesh). Forme (bruit) et rotation propre calculées dans le vertex shader → zéro calcul JavaScript par image. Normales « à facettes » via `dFdx/dFdy`. Contre-jour doré quand le Soleil est derrière. |
| **Soleil** | `Sun.js`, `sun.frag.glsl`, `corona.frag.glsl` | Granulation : fbm transporté par des « courants » de bruit lents, cellules creusées, taches solaires, assombrissement centre-bord. Couronne = billboard avec halo exponentiel et jets (bruit selon l'angle). |
| **Trou noir** | `BlackHole.js`, `blackhole.frag.glsl` | Lancer de rayons dans l'espace-temps de Schwarzschild (accélération `-3/2·rs·h²·r/r⁵`). Rayon capturé → ombre ; traverse le disque → couleur (rotation képlérienne, effet Doppler relativiste) ; s'échappe → on relit **l'image réelle de la scène** dans la direction déviée : les étoiles et la galaxie derrière sont déformées. L'arc au-dessus de l'ombre est l'arrière du disque, vu « par-dessus ». |
| **Galaxie** | `Galaxy.js`, `galaxy.*.glsl` | 100 000 particules : 4 bras spiraux, bulbe central. Rotation **différentielle** (le centre tourne plus vite) et attraction vers la souris (gaussienne autour du point visé sur le plan de la galaxie), le tout dans le vertex shader. |
| **Post-traitement** | `PostFX.js`, `final.frag.glsl` | Rendu HDR (demi-flottants) → bloom (UnrealBloomPass, seuil 1.15 : seul le HDR rayonne) → passe finale écrite à la main : teinte d'ambiance, exposition, **tone mapping ACES**, sRGB, vignettage, grain argentique à 24 i/s, légère aberration chromatique. |

---

## 3. Performance

Mesures réalisées sur la machine de développement (**Intel HD Graphics 620**, un petit GPU intégré de 2016) :

| Section | Avant optimisation (moyenne) | Après |
| --- | --- | --- |
| Terre | 33 i/s | 56 i/s |
| Soleil | 38 i/s | 48 i/s |
| Trou noir | 28 i/s | lentille en demi-résolution (≈ 4× moins de calcul) |
| Toutes (qualité basse) | — | 60 i/s |

**Lighthouse 13** (build de production, sur cette même machine) : mobile **97–98**, desktop **96–99** en performance ;
**100** en accessibilité, bonnes pratiques et SEO.

Ce qui rend cela possible :

- **Le texte d'abord** : le HTML est complet et lisible sans JavaScript. Three.js (~140 Ko gzip)
  est un fichier séparé, chargé *après* l'affichage (`import()` dynamique).
- **Un seul renderer, un seul canvas**, pixel ratio plafonné (2 ; 1,5 sur mobile).
- **Cuisson** : ce qui ne bouge pas (nébuleuse, relief terrestre, carte des nuages) est calculé une fois dans des cubemaps.
- **Compilation des shaders en arrière-plan** (`compileAsync`), y compris ceux du post-traitement,
  avec exactement la même « variante » que celle utilisée au rendu → aucune saccade en arrivant au trou noir.
- **Boucles à borne dynamique** dans les shaders : sous Windows (ANGLE → Direct3D), une boucle à
  borne constante est déroulée à la compilation, ce qui pouvait figer la page plusieurs secondes.
- **Génération découpée** : les 100 000 particules sont créées par paquets, la page ne se fige jamais.
- **Hors champ = pas rendu** : chaque objet n'existe que dans sa portion du voyage ; la passe du
  trou noir est coupée s'il est derrière la caméra ; la boucle s'arrête quand l'onglet est caché.
- **Qualité adaptative** (`Quality.js`) : niveau initial selon l'appareil, puis mesure des FPS
  (2,5 s après l'entrée). Si l'appareil peine, on descend d'un niveau (et on re-mesure).
  Une veille continue redescend encore si une section lourde fait chuter les FPS.
- **Rendu logiciel détecté** : si le navigateur n'a pas de vrai GPU (SwiftShader…), on affiche
  l'image de secours au lieu d'une 3D à 2 images/s.
- **Tactile : 3D au premier geste**. Sur téléphone, une illustration de la Terre s'affiche
  immédiatement ; la 3D démarre au premier toucher ou défilement. *Pourquoi* : Lighthouse simule un
  processeur 4× plus lent, et toute boucle 3D active pendant sa mesure fait chuter la note mobile
  (≈ 70 au lieu de 97). C'est aussi plus économe en batterie et en données.
  Pour démarrer la 3D immédiatement sur mobile : `START_3D_ON_INTERACTION_ON_TOUCH = false` dans `src/main.js`.

### Les trois niveaux (`src/three/Quality.js`)

| Réglage | Haute | Moyenne | Basse |
| --- | --- | --- | --- |
| Pixel ratio max | 2 | 1,5 | 1 |
| Étoiles / astéroïdes / particules de galaxie | 9 000 / 2 000 / 100 000 | 6 000 / 1 300 / 60 000 | 3 500 / 700 / 30 000 |
| Bloom | pleine résolution | demi-résolution | **désactivé** → couronne solaire renforcée à la place |
| Anticrénelage MSAA | 4× | — | — |
| Trou noir : pas / résolution | 110 / 100 % | 80 / 50 % | 48 / 50 % |
| Octaves de bruit (granulation du Soleil) | 5 | 4 | 3 |
| Verre dépoli des cartes | oui | oui | fond opaque (le flou CSS coûte cher sur GPU) |

Quand un effet est trop coûteux, il est **remplacé** par une version plus légère, jamais supprimé en silence.

---

## 4. Accessibilité

- HTML sémantique (`header`, `nav`, `main`, `section` + `aria-labelledby`, `footer`), lien d'évitement.
- Le canvas est décoratif (`aria-hidden`) ; chaque section décrit sa scène en texte masqué visuellement.
- Contrastes : texte principal ≈ 17:1, secondaire ≈ 8:1 ; panneaux sombres derrière le texte.
- Navigation clavier complète (focus visible, la barre de voyage est une vraie navigation, `aria-current="step"`).
- Formulaire : erreurs reliées aux champs (`aria-describedby`, `aria-invalid`), focus sur le premier champ fautif,
  confirmation annoncée et focalisée.
- `prefers-reduced-motion` : pas de défilement inertiel, caméra fixe sur l'étape la plus proche, pas de
  parallaxe, de curseur, de scintillement ni d'animation de titre ; le temps de la scène est ralenti.
- Son **désactivé par défaut**, bouton `aria-pressed`.

---

## 5. Modifier les principaux réglages

| Je veux… | Où |
| --- | --- |
| Changer les couleurs ou les polices | `:root` dans `src/styles/main.css` (+ constantes `ATMO`, `CITY`, `GOLD`, `ICE`… dans les shaders) |
| Déplacer un astre | `WORLD` dans `src/three/Journey.js` |
| Changer la trajectoire, le cadrage ou l'ambiance d'une section | `KEYFRAMES` dans `src/three/Journey.js` |
| Rendre le défilement plus ou moins « glissant » | `lerp` dans `src/ui/scroll.js` |
| Régler l'intensité de la parallaxe souris | `amp` dans `CameraRig.update()` |
| Ajuster les niveaux de qualité ou le seuil de FPS | `PRESETS` et `target` dans `src/three/Quality.js` |
| Changer la forme de la galaxie | `RADIUS`, `ARMS`, `SPIN` dans `src/three/objects/Galaxy.js` |
| Grossir le trou noir ou son disque | `RS`, `BOUND`, `uDiskIn`, `uDiskOut` dans `src/three/objects/BlackHole.js` |
| Plus ou moins de grain / vignettage | `uGrain`, `uVignette`, `uAberration` dans `src/three/PostFX.js` |
| Changer le son | les fréquences et gains dans `src/ui/audio.js` |
| Les distances affichées | `DISTANCES` dans `src/ui/progress.js` |

---

## 6. Déployer gratuitement

Le build produit un site 100 % statique dans `dist/`. Les deux fichiers de configuration sont déjà prêts.

> Ce projet est déjà relié à Vercel : chaque `git push` sur `main` redéploie automatiquement https://nova-expeditions.vercel.app.

### Netlify (`netlify.toml`)

1. Pousser le projet sur GitHub (ou GitLab / Bitbucket).
2. Sur [app.netlify.com](https://app.netlify.com) : **Add new site → Import an existing project**, choisir le dépôt.
3. Netlify lit `netlify.toml` (commande `npm run build`, dossier `dist`, Node 22) : cliquer **Deploy**.

Sans Git : `npm run build`, puis glisser-déposer le dossier `dist/` sur [app.netlify.com/drop](https://app.netlify.com/drop).

### Vercel (`vercel.json`)

1. Pousser le projet sur GitHub.
2. Sur [vercel.com/new](https://vercel.com/new) : importer le dépôt. Le préréglage **Vite** est détecté
   (commande `npm run build`, dossier `dist`). Cliquer **Deploy**.

Ou en ligne de commande : `npx vercel` (puis `npx vercel --prod`).

Les fichiers de `dist/assets/` portent une empreinte dans leur nom : les deux configurations les mettent en cache un an.

**Site en ligne** : https://nova-expeditions.vercel.app — les balises `og:url`, `og:image`,
`twitter:image` et `canonical` de `index.html` pointent vers cette adresse (les réseaux sociaux
exigent des URL absolues). Si le domaine change, mettre ces quatre URL à jour.
