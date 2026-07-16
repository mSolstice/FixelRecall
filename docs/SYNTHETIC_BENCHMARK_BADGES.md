# Synthetic Benchmark Badge Embeds

The GitHub Actions workflow `.github/workflows/synthetic-benchmark.yml` runs the deterministic
synthetic benchmark with no provider credentials and uploads local artifacts only.

Download the `context-diet-synthetic-benchmark` workflow artifact, then copy the SVG files into a
committed docs or assets folder if you choose to display them:

```md
![Context Diet benchmark](docs/badges/context-diet-benchmark.svg)
![Synthetic input reduction](docs/badges/context-diet-input-reduction.svg)
![Protected values imaged](docs/badges/context-diet-protected-imaged.svg)
![Compatibility status](docs/badges/context-diet-compatibility.svg)
```

Every numeric badge based on test data says `SYNTHETIC`. The workflow does not publish to an
external badge service and does not post pull-request comments automatically.
