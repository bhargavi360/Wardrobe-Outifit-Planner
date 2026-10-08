# Clothing category baseline

The ML package uses a pretrained MobileNetV2 feature extractor with a five-class
linear head for `top`, `bottom`, `dress`, `outerwear`, and `footwear`.

`src/train_clothing_classifier.py` trains the head using Fashion-MNIST. Its
mapping merges Fashion-MNIST's T-shirt/top, pullover, and shirt classes into
`top`, and excludes `Bag` because it is outside the target taxonomy. The
official Fashion-MNIST test split is used to compute accuracy and a confusion
matrix.

From the repository root, run with the backend Python environment:

```powershell
.\backend\.venv313\Scripts\python.exe .\ml\src\train_clothing_classifier.py
```

The script downloads the Fashion-MNIST data and pretrained MobileNetV2 weights
on first use. It saves trained weights, evaluation metrics, and model metadata
under `artifacts/`. These generated files are git-ignored. The Fashion-MNIST
baseline uses small grayscale images and should not be treated as production
accuracy for real-world wardrobe photos; retrain/fine-tune with a suitable
real-image fashion dataset before deployment.

Inference uses `wardrobe_ml.classifier.classify_image(image)` and returns a
category and softmax confidence. The classifier fails explicitly until the
trained weights file is available.

The backend's Phase 5 attribute pipeline separately uses OpenCV GrabCut with a
center-crop fallback, then scikit-learn KMeans to derive up to three named
foreground colors and their hex values. Pattern and sleeve estimates are
heuristics; uncertain pattern/sleeve values are reported as `unknown` rather
than presented as model predictions.
