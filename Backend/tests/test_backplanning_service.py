# ================================================================
# TenderZen — BackplanningService Tests
# Backend/tests/test_backplanning_service.py
# Datum: 2026-02-08
# ================================================================
#
# Unit tests voor de werkdag-berekening en planning-generatie.
# Draai met: pytest tests/test_backplanning_service.py -v
# ================================================================

import pytest
from datetime import date
from unittest.mock import AsyncMock, MagicMock

from app.services.backplanning_service import BackplanningService


# ════════════════════════════════════════════════
# FIXTURES
# ════════════════════════════════════════════════

@pytest.fixture
def service():
    """BackplanningService met een mock Supabase client."""
    mock_db = MagicMock()
    return BackplanningService(mock_db)


@pytest.fixture
def feestdagen_2026():
    """Nederlandse feestdagen 2026."""
    return {
        date(2026, 1, 1),    # Nieuwjaarsdag (do)
        date(2026, 4, 3),    # Goede Vrijdag
        date(2026, 4, 5),    # Eerste Paasdag (zo)
        date(2026, 4, 6),    # Tweede Paasdag (ma)
        date(2026, 4, 27),   # Koningsdag (ma)
        date(2026, 5, 5),    # Bevrijdingsdag (di)
        date(2026, 5, 14),   # Hemelvaartsdag (do)
        date(2026, 5, 15),   # Dag na Hemelvaart (vr)
        date(2026, 5, 24),   # Eerste Pinksterdag (zo)
        date(2026, 5, 25),   # Tweede Pinksterdag (ma)
        date(2026, 12, 25),  # Eerste Kerstdag (vr)
        date(2026, 12, 26),  # Tweede Kerstdag (za)
    }


@pytest.fixture
def sample_template_taken():
    """Vereenvoudigd template met 5 taken."""
    return [
        {
            'naam': 'Kick-off',
            'beschrijving': 'Start meeting',
            'rol': 'tendermanager',
            't_minus_werkdagen': 20,
            'duur_werkdagen': 1,
            'is_mijlpaal': True,
            'is_verplicht': True,
            'volgorde': 10
        },
        {
            'naam': 'Tekstschrijven',
            'beschrijving': 'Teksten schrijven',
            'rol': 'schrijver',
            't_minus_werkdagen': 15,
            'duur_werkdagen': 5,
            'is_mijlpaal': False,
            'is_verplicht': True,
            'volgorde': 20
        },
        {
            'naam': 'Review',
            'beschrijving': 'Interne review',
            'rol': 'reviewer',
            't_minus_werkdagen': 10,
            'duur_werkdagen': 2,
            'is_mijlpaal': False,
            'is_verplicht': True,
            'volgorde': 30
        },
        {
            'naam': 'INTERNE DEADLINE',
            'beschrijving': 'Alles af',
            'rol': 'tendermanager',
            't_minus_werkdagen': 3,
            'duur_werkdagen': 0,
            'is_mijlpaal': True,
            'is_verplicht': True,
            'volgorde': 40
        },
        {
            'naam': 'Indienen',
            'beschrijving': 'Indienen bij opdrachtgever',
            'rol': 'tendermanager',
            't_minus_werkdagen': 0,
            'duur_werkdagen': 0,
            'is_mijlpaal': True,
            'is_verplicht': True,
            'volgorde': 50
        }
    ]


@pytest.fixture
def team_assignments():
    return {
        'tendermanager': 'user-1',
        'schrijver': 'user-2',
        'reviewer': 'user-3'
    }


@pytest.fixture
def team_details():
    return {
        'user-1': {
            'id': 'user-1',
            'naam': 'Rick van Dam',
            'initialen': 'RI',
            'avatar_kleur': '#7c3aed'
        },
        'user-2': {
            'id': 'user-2',
            'naam': 'Nathalie Kuiper',
            'initialen': 'NA',
            'avatar_kleur': '#22c55e'
        },
        'user-3': {
            'id': 'user-3',
            'naam': 'Sarah Jansen',
            'initialen': 'SA',
            'avatar_kleur': '#f59e0b'
        }
    }


# ════════════════════════════════════════════════
# WERKDAG BEREKENING
# ════════════════════════════════════════════════

class TestIsWerkdag:
    """Test _is_werkdag methode."""

    def test_maandag_is_werkdag(self, service):
        assert service._is_werkdag(date(2026, 2, 9), set()) is True  # ma

    def test_vrijdag_is_werkdag(self, service):
        assert service._is_werkdag(date(2026, 2, 13), set()) is True  # vr

    def test_zaterdag_is_geen_werkdag(self, service):
        assert service._is_werkdag(date(2026, 2, 14), set()) is False  # za

    def test_zondag_is_geen_werkdag(self, service):
        assert service._is_werkdag(date(2026, 2, 15), set()) is False  # zo

    def test_feestdag_is_geen_werkdag(self, service):
        feestdagen = {date(2026, 4, 27)}  # Koningsdag (ma)
        assert service._is_werkdag(date(2026, 4, 27), feestdagen) is False

    def test_normale_dag_met_feestdagen_set(self, service):
        feestdagen = {date(2026, 4, 27)}
        assert service._is_werkdag(date(2026, 4, 28), feestdagen) is True  # di


class TestBerekenWerkdagTerug:
    """Test _bereken_werkdag_terug methode."""

    def test_t_minus_0_werkdag(self, service):
        # Deadline op een vrijdag → zelfde dag
        result = service._bereken_werkdag_terug(date(2026, 3, 13), 0, set())
        assert result == date(2026, 3, 13)  # vr

    def test_t_minus_0_weekend(self, service):
        # Deadline op een zondag → vorige vrijdag
        result = service._bereken_werkdag_terug(date(2026, 3, 15), 0, set())
        assert result == date(2026, 3, 13)  # vr

    def test_t_minus_1(self, service):
        # 1 werkdag terug vanaf maandag = vorige vrijdag
        result = service._bereken_werkdag_terug(date(2026, 3, 9), 1, set())
        assert result == date(2026, 3, 6)  # vr

    def test_t_minus_5_over_weekend(self, service):
        # 5 werkdagen terug vanaf vrijdag = vorige vrijdag
        result = service._bereken_werkdag_terug(date(2026, 3, 13), 5, set())
        assert result == date(2026, 3, 6)  # vr

    def test_t_minus_met_feestdag(self, service):
        # Koningsdag 27 apr 2026 is maandag
        feestdagen = {date(2026, 4, 27)}
        # 1 werkdag terug vanaf 28 apr (di) zou 27 overslaan → 24 apr (vr)
        result = service._bereken_werkdag_terug(
            date(2026, 4, 28), 1, feestdagen
        )
        assert result == date(2026, 4, 24)  # vr

    def test_t_minus_25_typische_tender(self, service):
        # 25 werkdagen = ~5 weken
        deadline = date(2026, 3, 15)  # zo → wordt vr 13 mrt bij T-0
        result = service._bereken_werkdag_terug(deadline, 25, set())
        # 25 werkdagen terug: 5 weken × 5 werkdagen
        assert result == date(2026, 2, 6)  # vr


class TestBerekenWerkdagVooruit:
    """Test _bereken_werkdag_vooruit methode."""

    def test_0_werkdagen_vooruit(self, service):
        result = service._bereken_werkdag_vooruit(date(2026, 3, 9), 0, set())
        assert result == date(2026, 3, 9)

    def test_1_werkdag_vooruit(self, service):
        result = service._bereken_werkdag_vooruit(date(2026, 3, 9), 1, set())
        assert result == date(2026, 3, 10)

    def test_4_werkdagen_over_weekend(self, service):
        # ma + 4 werkdagen = vr
        result = service._bereken_werkdag_vooruit(date(2026, 3, 9), 4, set())
        assert result == date(2026, 3, 13)  # vr

    def test_5_werkdagen_over_weekend(self, service):
        # ma + 5 werkdagen = volgende ma
        result = service._bereken_werkdag_vooruit(date(2026, 3, 9), 5, set())
        assert result == date(2026, 3, 16)  # ma

    def test_vooruit_met_feestdag(self, service):
        feestdagen = {date(2026, 3, 11)}  # wo feestdag
        # ma + 2 werkdagen: di is ok, wo is feestdag → do
        result = service._bereken_werkdag_vooruit(
            date(2026, 3, 9), 2, feestdagen
        )
        assert result == date(2026, 3, 12)  # do


# ════════════════════════════════════════════════
# PLANNING GENERATIE
# ════════════════════════════════════════════════

class TestBerekenPlanning:
    """Test _bereken_planning methode."""

    def test_basis_planning(
        self, service, sample_template_taken,
        team_assignments, team_details
    ):
        deadline = date(2026, 3, 13)  # vr
        planning = service._bereken_planning(
            deadline, sample_template_taken,
            team_assignments, team_details, set()
        )

        assert len(planning) == 5

        # Check volgorde behouden
        volgordes = [t['volgorde'] for t in planning]
        assert volgordes == sorted(volgordes)

    def test_persoon_toewijzing(
        self, service, sample_template_taken,
        team_assignments, team_details
    ):
        deadline = date(2026, 3, 13)
        planning = service._bereken_planning(
            deadline, sample_template_taken,
            team_assignments, team_details, set()
        )

        # Kick-off (tendermanager) → Rick
        assert planning[0]['toegewezen_aan']['naam'] == 'Rick van Dam'
        # Tekstschrijven (schrijver) → Nathalie
        assert planning[1]['toegewezen_aan']['naam'] == 'Nathalie Kuiper'
        # Review (reviewer) → Sarah
        assert planning[2]['toegewezen_aan']['naam'] == 'Sarah Jansen'

    def test_indienen_op_deadline(
        self, service, sample_template_taken,
        team_assignments, team_details
    ):
        deadline = date(2026, 3, 13)  # vr
        planning = service._bereken_planning(
            deadline, sample_template_taken,
            team_assignments, team_details, set()
        )

        # T-0 taak (Indienen) moet op de deadline vallen
        indienen = planning[-1]
        assert indienen['naam'] == 'Indienen'
        assert indienen['datum'] == '2026-03-13'

    def test_duur_meerdere_werkdagen(
        self, service, sample_template_taken,
        team_assignments, team_details
    ):
        deadline = date(2026, 3, 13)
        planning = service._bereken_planning(
            deadline, sample_template_taken,
            team_assignments, team_details, set()
        )

        # Tekstschrijven: duur = 5 werkdagen
        tekstschrijven = planning[1]
        assert tekstschrijven['duur_werkdagen'] == 5
        start = date.fromisoformat(tekstschrijven['datum'])
        eind = date.fromisoformat(tekstschrijven['eind_datum'])
        assert eind > start

    def test_ontbrekende_rol_geen_crash(
        self, service, sample_template_taken, team_details
    ):
        # Alleen tendermanager toegewezen, reviewer ontbreekt
        partial_assignments = {'tendermanager': 'user-1'}
        deadline = date(2026, 3, 13)

        planning = service._bereken_planning(
            deadline, sample_template_taken,
            partial_assignments, team_details, set()
        )

        # Moet niet crashen, reviewer taak heeft None als persoon
        review = planning[2]
        assert review['toegewezen_aan'] is None

    def test_feestdagen_worden_overgeslagen(
        self, service, sample_template_taken,
        team_assignments, team_details, feestdagen_2026
    ):
        # Deadline 30 april 2026 (do)
        deadline = date(2026, 4, 30)
        planning = service._bereken_planning(
            deadline, sample_template_taken,
            team_assignments, team_details, feestdagen_2026
        )

        # Alle datums moeten werkdagen zijn
        for taak in planning:
            taak_datum = date.fromisoformat(taak['datum'])
            assert service._is_werkdag(taak_datum, feestdagen_2026), \
                f"{taak['naam']} valt op niet-werkdag {taak_datum}"


# ════════════════════════════════════════════════
# METADATA
# ════════════════════════════════════════════════

class TestBerekenMetadata:
    """Test _bereken_metadata methode."""

    def test_basis_metadata(self, service):
        deadline = date(2026, 3, 13)
        planning = [
            {'datum': '2026-02-13'},
            {'datum': '2026-02-20'},
            {'datum': '2026-03-13'}
        ]

        meta = service._bereken_metadata(deadline, planning, set())

        assert meta['eerste_taak'] == '2026-02-13'
        assert meta['laatste_taak'] == '2026-03-13'
        assert meta['deadline'] == '2026-03-13'
        assert meta['doorlooptijd_kalenderdagen'] == 28
        assert meta['doorlooptijd_werkdagen'] > 0

    def test_lege_planning(self, service):
        meta = service._bereken_metadata(date(2026, 3, 13), [], set())
        assert meta['eerste_taak'] is None
        assert meta['doorlooptijd_werkdagen'] == 0

    def test_feestdagen_in_metadata(self, service, feestdagen_2026):
        deadline = date(2026, 5, 30)
        planning = [{'datum': '2026-04-01'}]

        meta = service._bereken_metadata(deadline, planning, feestdagen_2026)

        # Meerdere feestdagen vallen in april-mei 2026
        assert len(meta['feestdagen_overgeslagen']) > 0
        assert '2026-04-06' in meta['feestdagen_overgeslagen']  # 2e Paasdag
        assert '2026-04-27' in meta['feestdagen_overgeslagen']  # Koningsdag


# ════════════════════════════════════════════════
# CONFLICT HANDLING
# ════════════════════════════════════════════════

class TestAttachConflicts:
    """Test _attach_conflicts methode."""

    def test_conflict_wordt_toegevoegd(self, service):
        taken = [
            {
                'naam': 'Test',
                'datum': '2026-03-10',
                'toegewezen_aan': {'id': 'user-1', 'naam': 'Rick'}
            }
        ]
        warnings = [
            {
                'persoon_id': 'user-1',
                'persoon': 'Rick',
                'datum': '2026-03-10',
                'week': '2026-W11',
                'taken_count': 5,
                'severity': 'danger',
                'bericht': 'Rick heeft al 5 taken op 2026-03-10'
            }
        ]

        service._attach_conflicts(taken, warnings)

        assert 'conflict' in taken[0]
        assert taken[0]['conflict']['severity'] == 'danger'

    def test_geen_conflict_bij_andere_datum(self, service):
        taken = [
            {
                'naam': 'Test',
                'datum': '2026-03-11',
                'toegewezen_aan': {'id': 'user-1', 'naam': 'Rick'}
            }
        ]
        warnings = [
            {
                'persoon_id': 'user-1',
                'datum': '2026-03-10',
                'bericht': 'test',
                'severity': 'warning'
            }
        ]

        service._attach_conflicts(taken, warnings)
        assert 'conflict' not in taken[0]

    def test_geen_crash_zonder_persoon(self, service):
        taken = [
            {
                'naam': 'Test',
                'datum': '2026-03-10',
                'toegewezen_aan': None
            }
        ]
        warnings = [{'persoon_id': 'user-1', 'datum': '2026-03-10'}]

        # Mag niet crashen
        service._attach_conflicts(taken, warnings)