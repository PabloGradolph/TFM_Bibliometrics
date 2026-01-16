from django.contrib.auth import get_user_model
from django.test import Client, TestCase
from django.urls import reverse

from bibliodata.models import Author, Publication


class ExportReportFormatsTest(TestCase):
    """Smoke tests for export_report endpoint ensuring new formats respond successfully.

    These tests create a minimal dataset and authenticate a user, then call the
    export endpoint with different format parameters. They validate HTTP 200 and
    basic content-type correctness for each implemented format (excluding PDF charts).
    """

    def setUp(self):
        """Create a minimal dataset and authenticate a user."""
        user_model = get_user_model()
        self.user = user_model.objects.create_user(username='tester', password='pass1234')
        self.client = Client()
        self.client.login(username='tester', password='pass1234')

        # Minimal publication + author
        self.author = Author.objects.create(gesbib_id='A1', name='Alice Example')
        self.pub = Publication.objects.create(
            gb_id='P1', title='Example Publication', year=2024, citations=5
        )
        self.pub.authors.add(self.author)

        self.url = reverse('export_report')  # core/urls.py name


    def _assert_ok(self, fmt, expected_ct_part):
        resp = self.client.post(self.url, {'format': fmt})
        self.assertEqual(resp.status_code, 200, f"Format {fmt} did not return 200")
        self.assertIn(expected_ct_part, resp['Content-Type'], f"Unexpected content type for {fmt}")

    def test_csv(self):
        self._assert_ok('csv', 'text/csv')

    def test_ndjson(self):
        self._assert_ok('ndjson', 'application/x-ndjson')

    def test_bibtex(self):
        self._assert_ok('bibtex', 'application/x-bibtex')

    def test_ris(self):
        self._assert_ok('ris', 'application/x-research-info-systems')

    def test_gexf(self):
        self._assert_ok('gexf', 'application/gexf+xml')

    def test_network_csv(self):
        self._assert_ok('network_csv', 'text/csv')

    def test_zip(self):
        self._assert_ok('zip', 'application/zip')

    def test_pdf(self):
        # PDF requires fallback; just ensure 200 and pdf mime
        resp = self.client.post(self.url, {'format': 'pdf'})
        self.assertEqual(resp.status_code, 200)
        self.assertIn('application/pdf', resp['Content-Type'])


class AuthorSuggestionsCountsTest(TestCase):
    """Regression tests for author suggestion publication counts.

    Contract:
    - Counts must respect non-author dashboard filters (year/quartile/etc.).
    - Counts must NOT be affected by authors already selected in the UI.
      (Selecting Edu should not change the count shown for Javier.)
    """

    def setUp(self):
        """Create a small dataset and authenticate a user."""
        user_model = get_user_model()
        self.user = user_model.objects.create_user(username='tester2', password='pass1234')
        self.client = Client()
        self.client.login(username='tester2', password='pass1234')

        self.author_a = Author.objects.create(gesbib_id='A10', name='Javier Martin')
        self.author_b = Author.objects.create(gesbib_id='A11', name='Edu Example')

        pub_2020 = Publication.objects.create(gb_id='P10', title='Paper 2020', year=2020, citations=1)
        pub_2021 = Publication.objects.create(gb_id='P11', title='Paper 2021', year=2021, citations=1)
        pub_2022 = Publication.objects.create(gb_id='P12', title='Paper 2022', year=2022, citations=1)

        pub_2020.authors.add(self.author_a)
        pub_2021.authors.add(self.author_a)
        pub_2022.authors.add(self.author_a, self.author_b)

        self.url = reverse('get_author_suggestions')

    def _get_count_for(self, resp_json, name):
        for item in resp_json.get('suggestions', []):
            if item.get('name') == name:
                return item.get('count')
        return None

    def test_counts_ignore_selected_authors(self):
        """Selecting an author must not shrink another author's suggestion count."""
        resp = self.client.get(self.url, {'q': 'Javier'})
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        baseline = self._get_count_for(data, 'Javier Martin')
        self.assertEqual(baseline, 3)

        # Now call again as if Edu was already selected in the UI.
        # The count for Javier should remain the same.
        resp2 = self.client.get(self.url, {'q': 'Javier', 'author': 'Edu Example'})
        self.assertEqual(resp2.status_code, 200)
        data2 = resp2.json()
        with_selected = self._get_count_for(data2, 'Javier Martin')
        self.assertEqual(with_selected, 3)

    def test_counts_still_respect_non_author_filters(self):
        """Year filter should reduce the counts, even when authors are selected."""
        resp = self.client.get(self.url, {'q': 'Javier', 'year_from': '2022', 'year_to': '2022'})
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        # Only Paper 2022 remains
        self.assertEqual(self._get_count_for(data, 'Javier Martin'), 1)

        # Selecting Edu additionally should not change the count for Javier.
        resp2 = self.client.get(
            self.url,
            {'q': 'Javier', 'year_from': '2022', 'year_to': '2022', 'author': 'Edu Example'},
        )
        self.assertEqual(resp2.status_code, 200)
        data2 = resp2.json()
        self.assertEqual(self._get_count_for(data2, 'Javier Martin'), 1)

    def test_pdf_with_collaboration_maps(self):
        """PDF export should accept optional collaboration map images.

        We only validate the request succeeds. Rendering correctness is covered
        by manual UI testing because the images are captured client-side.
        """
        # 1x1 transparent PNG
        tiny_png = (
            'data:image/png;base64,'
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/6X9qWcAAAAASUVORK5CYII='
        )
        resp = self.client.post(
            self.url,
            {
                'format': 'pdf',
                'lang': 'en',
                'collab_map_world_img': tiny_png,
                'collab_map_spain_img': tiny_png,
            },
        )
        self.assertEqual(resp.status_code, 200)
        self.assertIn('application/pdf', resp['Content-Type'])
