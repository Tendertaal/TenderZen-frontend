
# Project File Overview: TenderZen

Dit document geeft een uitgebreide beschrijving van alle belangrijke bestanden en mappen in het TenderZen project. Per bestand wordt uitgelegd wat het doet en waarvoor het bedoeld is, zodat een senior developer direct inzicht krijgt in de projectstructuur.

---


## Root Directory
- **INSTRUCTIE_RODE_DRAAD_SESSIE_GENERATOR IMPLEMENTATIE in TenderPlanner tool.md**: Uitgebreide instructies voor het implementeren van de rode draad sessie generator in de TenderPlanner tool. Bevat stapsgewijze uitleg, achtergrondinformatie en best practices voor het integreren van deze functionaliteit in de workflow.
- **push-to-github.ps1**: PowerShell script dat het proces automatiseert om lokale wijzigingen naar GitHub te pushen. Gebruikt standaard git commando's en is bedoeld voor snelle deployment en versiebeheer zonder handmatige stappen.
- **README.md**: Centrale projectdocumentatie met installatie-instructies, uitleg over architectuur, gebruikte technologieën (zoals Python, FastAPI, HTML/CSS/JS), en een overzicht van de belangrijkste workflows. Hier vind je ook links naar verdere documentatie en onboarding.
- **TenderZen Workspace.code-workspace**: VS Code workspace configuratiebestand. Zorgt ervoor dat de juiste mappen, extensies en instellingen geladen worden bij het openen van het project. Maakt samenwerking en consistentie tussen developers eenvoudiger.


## Backend/
- **README.md**: Documentatie specifiek voor de backend. Bevat uitleg over opzet, dependencies, het draaien van de backend server, en architectuurkeuzes zoals het gebruik van FastAPI, dependency injection en database structuur.
- **requirements.txt**: Lijst met Python packages (zoals FastAPI, SQLAlchemy, Pydantic, Alembic) die nodig zijn voor de backend. Wordt gebruikt door pip om dependencies te installeren. Essentieel voor consistentie tussen ontwikkel- en productieomgevingen.
- **runtime.txt**: Geeft aan welke Python versie gebruikt moet worden voor deployment (bijvoorbeeld op Heroku). Voorkomt versieconflicten en deployment errors.
- **test_config.py**: Testscript om te controleren of de configuratie van de backend correct is ingesteld. Wordt gebruikt bij CI/CD pipelines en lokale validatie.
- **test-backend.html**: HTML testpagina waarmee frontend/backend integratie getest kan worden. Simuleert API calls en toont responses voor debugging.
- **app/**: Hoofdmap van de backend applicatie. Hier bevindt zich alle kerncode.
  - **__init__.py**: Maakt van de app map een Python package, zodat submodules geïmporteerd kunnen worden. Nodig voor package management en testing.
  - **config.py**: Bevat alle configuratievariabelen en settings voor de backend applicatie (zoals database connectie, secret keys, third-party API credentials). Wordt geïmporteerd door main.py, services/ en middleware/ voor centrale configuratie.
  - **main.py**: Startpunt van de backend server. Hier wordt de FastAPI-app geïnitialiseerd, routers gekoppeld, middleware toegevoegd en globale configuratie geregeld. Werkt samen met config.py en routers/.
  - **api/**: Hier staan de API endpoints gedefinieerd. Elke file beschrijft een set van routes voor een bepaald domein (zoals gebruikers, tenders, planning). Endpoints zijn gekoppeld aan services/ en models/ voor data-afhandeling.
  - **core/**: Bevat kernfunctionaliteit en utilities die door de hele backend gebruikt worden, zoals authenticatie, logging, error handling en helper functies. Wordt hergebruikt door routers/ en services/.
  - **middleware/**: Middleware componenten die requests en responses verwerken, bijvoorbeeld voor security (JWT, CORS), logging, rate limiting of error handling. Wordt automatisch toegepast op alle inkomende requests.
  - **models/**: Definieert de datamodellen (ORM classes, Pydantic schemas) die gebruikt worden voor database interactie en validatie. Elk model representeert een tabel en bevat validatie, relaties en migratie-informatie. Wordt gebruikt door services/ en routers/.
  - **routers/**: Hier worden de routes van de API endpoints georganiseerd en gekoppeld aan de juiste handlers. Routers splitsen de API op in logische domeinen en zorgen voor overzicht en modulariteit.
  - **services/**: Business logic en services die de kern van de applicatie vormen. Hier worden complexe processen en interacties afgehandeld, zoals planningen, gebruikersbeheer, en communicatie met externe APIs. Services zijn herbruikbaar en worden aangeroepen door routers/ en middleware/.
- **db/**: Database gerelateerde bestanden, zoals migraties en seed scripts.
  - **migrations/**: Database migratiescripts (bijvoorbeeld voor Alembic). Hiermee worden wijzigingen in het datamodel doorgevoerd, zoals nieuwe tabellen, kolommen of constraints. Essentieel voor versiebeheer van de database.
- **scripts/**: Diverse hulpscripts voor onderhoud en beheer, zoals data cleaning, template fixes en batch operations.
  - **fix_templates.py**: Script dat template-bestanden controleert en waar nodig repareert. Wordt gebruikt bij updates van templates en migraties.
- **tests/**: Unit en integratietests voor de backend. Testen business logic, API endpoints en database interacties.
  - **__init__.py**: Maakt van de tests map een Python package, zodat testmodules geïmporteerd kunnen worden.
  - **test_backplanning_service.py**: Testcases voor de backplanning service, controleert correcte werking van planningslogica, edge cases en foutafhandeling. Wordt gebruikt bij CI/CD en lokale ontwikkeling.


## Documentatie/
- **Handover_TCC_Implementatie_20260210_1100.md**: Document met overdrachtsinformatie voor de implementatie van Tender Command Center (TCC). Bevat uitleg over functionaliteit, technische keuzes, architectuur en lessons learned. Belangrijk voor kennisoverdracht tussen teams.
- **Implementatie_PlanningViews_20260207_1700.md**: Beschrijft de implementatie van verschillende planningsviews in de frontend/backend. Bevat wireframes, use-cases en technische integratiepunten.
- **IMPLEMENTATION_GUIDE_20260116_1300.md**: Algemene implementatiegids voor het project, met best practices, architectuurkeuzes, design patterns (zoals MVC, service-oriented architecture) en security-aspecten. Bevat diagrammen en voorbeelden van typische workflows.
- **Integratie_AgendaView_20260208_1430.md**: Uitleg over de integratie van de AgendaView module in het project, inclusief API endpoints, dataflow en UI-componenten.
- **Integratie_SmartImportV4_20260209_0930.md**: Documentatie over de integratie van SmartImport versie 4, met focus op data mapping, validatie en error handling.
- **Planning_AllViews_20260207_1640.html**: HTML overzicht van alle planningsviews, bedoeld als visuele referentie voor developers en stakeholders.
- **SAMENVATTING_SESSIE_20260115.md**: Samenvatting van een belangrijke project sessie, met besluiten, actiepunten en impact op roadmap en architectuur.
- **SmartImport_v4_Implementatieplan_20260208_2100.md**: Uitgewerkt implementatieplan voor SmartImport v4, inclusief technische details, migratiestrategie en testscenario’s.
- **TenderCommandCenter_v7_20260210_1045.html**: HTML mockup van versie 7 van het Tender Command Center. Wordt gebruikt voor UI/UX design en validatie.
- **TenderZen_Planning_Popup_Mockup.html**: Mockup van de planning popup functionaliteit, met focus op gebruikersinteractie en visuele consistentie.
- **TenderZen_SmartImport_FD_TD_v1.0.md**: Functioneel en technisch ontwerp voor SmartImport, inclusief requirements, dataflow en security.
- **UserResolution_ImplementatieVoorbeeld.js**: Voorbeeldscript voor de implementatie van user resolution functionaliteit. Toont best practices voor user matching en data-integratie.


## frontend/
- **accept-invitation.html**: Pagina waarmee gebruikers een uitnodiging kunnen accepteren en hun account activeren. Bevat validatie, koppeling met backend en feedback voor de gebruiker.
- **file-checker.html**: Utility pagina waarmee gebruikers bestanden kunnen controleren op geldigheid of inhoud. Gebruikt JavaScript voor bestandsanalyse en toont resultaten in de UI.
- **forgot-password.html**: Pagina voor het aanvragen van een wachtwoord reset. Stuurt een reset-link naar het opgegeven e-mailadres via een API-call naar de backend. Bevat validatie en error handling.
- **iconen-overzicht.html**: Overzichtspagina van alle gebruikte iconen in de frontend, bedoeld voor design en development. Helpt bij consistent gebruik van iconografie.
- **index.html**: Hoofdpagina van de frontend webapplicatie. Laadt alle essentiële CSS en JS, bevat root-elementen voor SPA-functionaliteit en start de gebruikerservaring.
- **login.html**: Loginpagina voor gebruikersauthenticatie. Bevat inputvalidatie, error handling en koppeling met backend authenticatie endpoints.
- **README.md**: Documentatie specifiek voor de frontend, met uitleg over opzet, build-proces, gebruikte technologieën (HTML, CSS, JavaScript, eventueel frameworks) en deployment.
- **reset-password.html**: Pagina waar gebruikers hun wachtwoord daadwerkelijk kunnen wijzigen na het ontvangen van een reset-link. Bevat validatie, koppeling met backend en feedback.
- **Signup.html**: Registratiepagina voor nieuwe gebruikers. Bevat validatie, koppeling met backend en error handling.
- **team-members-test.html**: Testpagina voor het beheren en weergeven van teamleden. Gebruikt mockdata en API-calls voor interactie.
- **test-backend.html**: Testpagina waarmee frontend/backend communicatie getest kan worden. Simuleert API-calls en toont responses.
- **test-password-reset.html**: Testpagina voor het wachtwoord reset proces. Test verschillende scenario’s en error cases.
- **css/**: Map met alle stylesheets voor de frontend. Elke CSS file is verantwoordelijk voor de styling van een specifieke component of view. Gebruik van CSS variables, BEM-methodologie en responsive design.
  - **AgendaView.css**: Styling voor de agenda/planning view. Bevat layout, kleuren en interactie voor planningscomponenten.
  - **ai-documenten-modal.css**: Styling voor modals die AI-documenten tonen. Zorgt voor consistente modale weergave en animaties.
  - **ai-template-cards.css**: Styling voor AI template cards. Bevat grid-layouts, hover-effecten en responsive design.
  - **badge.css**: Styling voor badge componenten (labels, status indicators). Zorgt voor visuele statuscommunicatie.
  - **base.css**: Basis styles die overal in de frontend gebruikt worden, zoals typografie, kleuren en spacing.
  - **BedrijfModal.css**: Styling voor modals waarin bedrijfsinformatie wordt getoond. Bevat layout en interactie.
  - **BedrijfSelector.css**: Styling voor de bedrijfsselector component. Zorgt voor gebruiksvriendelijke selectie van bedrijven.
  - **BedrijvenView.css**: Styling voor de bedrijven overzichtspagina. Bevat tabellen, filters en responsive design.
  - **BureauSwitcher.css**: Styling voor de bureau switcher component. Maakt snelle wisseling tussen bureaus mogelijk.
  - **components.css**: Algemene component styles voor herbruikbare UI elementen. Bevat knoppen, formulieren, cards, etc.
  - **Header-backup.css**: Backup van header styles, voor fallback of testdoeleinden. Wordt gebruikt bij refactoring of designwijzigingen.
  - **Header-bureau-integration.css**: Styling voor de bureau-integratie header. Zorgt voor visuele integratie tussen verschillende bureaus.
  - **Header.css**: Hoofdheader styles voor de webapp. Bevat layout, kleuren en interactie.
  - **HeadersRow.css**: Styling voor rijen in de header. Zorgt voor consistente uitlijning en spacing.
  - **inline-date-picker.css**: Styling voor inline date picker componenten. Bevat kalenderlayout en interactie.
  - **KanbanView.css**: Styling voor de Kanban view. Bevat kolommen, kaarten en drag-and-drop functionaliteit.
  - **login.css**: Styling voor de loginpagina. Zorgt voor duidelijke en toegankelijke login UI.
  - **main.css**: Hoofdstylesheet voor de frontend, bevat globale styles zoals layout, kleuren en typografie. Wordt geïmporteerd door alle pagina’s.
  - **mfa.css**: Styling voor multi-factor authenticatie componenten. Bevat inputvelden, validatie en feedback.
  - **modal-base.css**: Basis styles voor modals. Zorgt voor consistente modale weergave en animaties.
  - **multi-bureau-extra.css**: Extra styles voor multi-bureau functionaliteit. Zorgt voor visuele onderscheid tussen verschillende bureaus.
  - **Planningmodal.css**: Styling voor de planning modal. Bevat layout, kleuren en interactie.
  - **ProfileDropdown.css**: Styling voor de profiel dropdown. Zorgt voor gebruiksvriendelijke navigatie en interactie.
  - **styles.css**: Algemene styles voor de frontend. Bevat basis layout, kleuren en typografie.
  - **table-view.css**: Styling voor tabellen en table views. Bevat sortering, filtering en responsive design.
  - **TeamlidModal.css**: Styling voor modals met teamleden. Bevat layout en interactie.
  - **tender-card.css**: Styling voor tender card componenten. Zorgt voor visuele presentatie van tenders.
  - **tender-cards.css backup**: Backup van tender cards styles. Wordt gebruikt bij refactoring of designwijzigingen.
  - **TenderAanmaken.css**: Styling voor tender aanmaakpagina. Bevat formulieren, validatie en feedback.
  - **TenderbureauModal.css**: Styling voor tender bureau modals. Bevat layout en interactie.
  - **TenderbureausView.css**: Styling voor tender bureaus overzicht. Bevat tabellen, filters en responsive design.
  - **TenderCommandCenter.css**: Styling voor de Tender Command Center pagina/component. Zorgt voor visuele consistentie en branding.
  - **totaal-view.css**: Styling voor totaaloverzichten. Bevat layout, kleuren en interactie.
  - **variables.css**: CSS variabelen voor theming en consistentie. Wordt gebruikt door alle stylesheets.
  - **views.css**: Algemene view styles. Bevat layout en responsive design voor verschillende pagina’s.
- **js/**: Map met JavaScript bestanden voor frontend logica, interacties en API calls. Scripts zijn modulair opgezet, gebruiken fetch/axios voor communicatie met de backend en beheren state en UI-interactie.
- **pages/**: Extra HTML pagina's voor specifieke functionaliteit of views. Worden gebruikt voor losse features, testcases of documentatie.


## supabase/
- **functions/**: Map met serverless functies voor Supabase integratie. Hier staan scripts die backend functionaliteit bieden via Supabase, zoals data-opslag, authenticatie en triggers. Wordt gebruikt voor schaalbare en onderhoudsvrije backend logica.


## venv311/
- **pyvenv.cfg**: Configuratiebestand voor de Python virtual environment. Geeft aan hoe de omgeving is opgezet en welke Python versie gebruikt wordt. Essentieel voor dependency management en isolatie van packages.
- **Include/**: Bevat Python header files die nodig zijn voor extensies en packages. Wordt gebruikt bij het bouwen van C-extensies en advanced packages.
- **Lib/**: Standaard Python library files die door de virtual environment gebruikt worden. Bevat alle geïnstalleerde packages en dependencies.
- **Scripts/**: Uitvoerbare scripts en binaries voor de virtual environment (zoals pip, python.exe, activate.bat). Wordt gebruikt voor package management, activatie en deployment.

---

Dit overzicht beschrijft alle belangrijke bestanden en mappen met hun functie en context. Raadpleeg de README bestanden en documentatie voor meer details per onderdeel.