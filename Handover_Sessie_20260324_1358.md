# Handover — Sessie 20260324_1358

## Afgerond in deze sessie

### Notities feature (volledig geïmplementeerd)
- tender_notities tabel aangemaakt in Supabase met RLS policies
- TCC_TabNotities.js — volledig component met:
  - Zijpaneel (480px) naast TCC content
  - @mention dropdown — alleen tender-teamleden, lege-state melding
  - Actie-label → automatisch taak aanmaken in planning_taken
  - Twee-staps gebruikersdata laden (public.users apart van auth.users)
  - Paarse header + knop rechts in footer
- TCC_Core.js v3.6 — tccIcon() bugfix, notities init/destroy
- planning_taken uitgebreid met bron, notitie_id, aangemaakt_door

## Openstaande punten

### Team tab — teamleden toevoegen werkt niet
- Zoekbalk toont alleen "Admin TenderZen" (zichzelf)
- Toevoegen knop heeft geen effect
- 2 verplichte rollen niet ingevuld: Tendermanager, Schrijver
- Rolverdeling toont alle rollen als Vacant
- Workload sectie leeg
- Onderzoeken: TCC_TabTeam.js + handleTeamAddMember() +
  handleTeamSearchInput() + loadTeamWorkload()
