from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
import pandas as pd


df = pd.read_csv("flag_crash_data.csv")

X = df.drop("CrashNearby", axis=1)
y = df["CrashNearby"]

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

model = LogisticRegression()
model.fit(X_train, y_train)

weights = model.coef_[0]
for flag, weight in zip(X.columns, weights):
    print(f"{flag}: {weight:.2f}")
