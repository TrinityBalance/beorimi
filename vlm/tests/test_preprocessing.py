import tempfile
import unittest
from pathlib import Path

from vlm.app.preprocessing import images_in_directory, resolve_image_paths


class ImageDiscoveryTests(unittest.TestCase):
    def test_images_are_sorted_and_non_images_are_ignored(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            directory = Path(temporary_directory)
            (directory / "b.png").touch()
            (directory / "a.jpg").touch()
            (directory / "notes.txt").touch()

            self.assertEqual(
                [path.name for path in images_in_directory(directory)],
                ["a.jpg", "b.png"],
            )

    def test_directory_argument_is_expanded(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            directory = Path(temporary_directory)
            image = directory / "waste.webp"
            image.touch()

            self.assertEqual(resolve_image_paths([directory]), [image])


if __name__ == "__main__":
    unittest.main()
