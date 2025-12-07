"""Model indexer for discovering models in a directory."""

import json
from pathlib import Path
from typing import List, Optional

from .models import ModelInfo
from .config import settings


class ModelIndexer:
    """Indexes models in a directory."""

    def __init__(self, models_dir: Optional[Path] = None):
        self.models_dir = models_dir or settings.models_dir

    def scan_models(self) -> List[ModelInfo]:
        """Scan the models directory and return model information."""
        models = []

        if not self.models_dir.exists():
            return models

        for item in self.models_dir.iterdir():
            if item.is_dir():
                model_info = self._analyze_model(item)
                if model_info:
                    models.append(model_info)

        return sorted(models, key=lambda m: m.name)

    def _analyze_model(self, path: Path) -> Optional[ModelInfo]:
        """Analyze a potential model directory."""
        # Check for common model files
        config_json = path / "config.json"
        has_config = config_json.exists()

        # Check for model files
        model_files = list(path.glob("*.safetensors")) + \
                      list(path.glob("*.bin")) + \
                      list(path.glob("*.pt"))

        if not has_config and not model_files:
            return None

        # Get model type from config
        model_type = None
        if has_config:
            try:
                with open(config_json) as f:
                    config = json.load(f)
                    model_type = config.get("model_type") or config.get("architectures", [None])[0]
            except:
                pass

        # Calculate size
        size_gb = None
        try:
            total_size = sum(f.stat().st_size for f in path.rglob("*") if f.is_file())
            size_gb = round(total_size / (1024**3), 2)
        except:
            pass

        return ModelInfo(
            path=str(path),
            name=path.name,
            size_gb=size_gb,
            has_config=has_config,
            model_type=model_type
        )

    def get_model(self, path: str) -> Optional[ModelInfo]:
        """Get info for a specific model path."""
        model_path = Path(path)
        if model_path.exists() and model_path.is_dir():
            return self._analyze_model(model_path)
        return None
