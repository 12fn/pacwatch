import os
import subprocess
import unittest
import zipfile

FAKE_KEY = 'sk-test-not-a-real-key'


def build(env_extra=None, expect_success=True):
    env = dict(os.environ)
    env.pop('PACWATCH_API_KEY', None)
    if env_extra:
        env.update(env_extra)
    result = subprocess.run(['python3', 'tools/build_zip.py'],
                            capture_output=True, text=True, env=env)
    if expect_success and result.returncode != 0:
        raise AssertionError(f'build failed:\n{result.stderr}')
    return result


class TestBuild(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        build({'PACWATCH_API_KEY': FAKE_KEY})

    def test_zip_exists_and_is_small(self):
        self.assertTrue(os.path.exists('dist/pacwatch.zip'))
        self.assertLess(os.path.getsize('dist/pacwatch.zip'), 400_000)

    def test_unzipped_payload_under_one_megabyte(self):
        with zipfile.ZipFile('dist/pacwatch.zip') as archive:
            total = sum(info.file_size for info in archive.infolist())
        self.assertLess(total, 1_048_576, f'payload is {total} bytes')

    def test_no_instructor_or_tooling_shipped(self):
        with zipfile.ZipFile('dist/pacwatch.zip') as archive:
            names = archive.namelist()
        for banned in ['instructor/', 'tools/', 'tests/', '.git/',
                       'superpowers/', '.verify/']:
            self.assertFalse(any(banned in n for n in names),
                             f'{banned} leaked into the student zip')

    def test_answer_key_content_absent(self):
        """Not just the file -- the answers themselves must not appear."""
        with zipfile.ZipFile('dist/pacwatch.zip') as archive:
            blob = b''.join(
                archive.read(n) for n in archive.namelist()
                if n.endswith(('.js', '.md', '.html', '.css')))
        for phrase in [b'ANSWER-KEY', b'RUN-OF-SHOW', b'DEMO-SCRIPT']:
            self.assertNotIn(phrase, blob)

    def test_scenario_does_not_label_the_planted_vessels(self):
        with zipfile.ZipFile('dist/pacwatch.zip') as archive:
            scenario = archive.read('pacwatch/data/scenario.js').decode().lower()
        for word in ['synthetic', 'anomal', 'suspicious', 'planted']:
            self.assertNotIn(word, scenario,
                             f'"{word}" in scenario.js gives away the exercise')

    def test_the_students_get_what_they_need(self):
        with zipfile.ZipFile('dist/pacwatch.zip') as archive:
            names = set(archive.namelist())
        for required in ['pacwatch/START-HERE.html', 'pacwatch/index.html',
                         'pacwatch/README.md', 'pacwatch/AGENTS.md',
                         'pacwatch/config.js', 'pacwatch/js/detect.js',
                         'pacwatch/data/scenario.js', 'pacwatch/vendor/leaflet.js',
                         'pacwatch/docs/TROUBLESHOOTING.md']:
            self.assertIn(required, names, f'{required} missing from the zip')

    def test_key_is_injected(self):
        with zipfile.ZipFile('dist/pacwatch.zip') as archive:
            config = archive.read('pacwatch/config.js').decode()
        self.assertIn(FAKE_KEY, config)

    def test_build_refuses_to_ship_without_a_key(self):
        result = build(expect_success=False)
        self.assertNotEqual(result.returncode, 0,
                            'a zip with no key dies in front of the room')
        self.assertIn('PACWATCH_API_KEY', result.stderr)


if __name__ == '__main__':
    unittest.main()
