# ai_engine/train.py
import joblib
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report
from sklearn.model_selection import GroupShuffleSplit
from sklearn.pipeline import make_pipeline

df = pd.read_csv("sample_data/documents.csv")  # columns: text, label, group

splitter = GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=42)
train_idx, test_idx = next(splitter.split(df, groups=df["group"]))
train, test = df.iloc[train_idx], df.iloc[test_idx]

model = make_pipeline(
    TfidfVectorizer(ngram_range=(1, 2), min_df=2),
    LogisticRegression(max_iter=1000, class_weight="balanced"),
)
model.fit(train["text"], train["label"])

print(classification_report(test["label"], model.predict(test["text"])))
joblib.dump(model, "ai_engine/models/doc_classifier.joblib")