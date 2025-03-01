'use client';
import { useEffect, useState, useRef } from "react";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";

export default function Home() {
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  // foodData holds an array of meal objects; each meal has a date, list of foods, and computed totalMacros
  const [foodData, setFoodData] = useState([]);
  const [dailyTarget, setDailyTarget] = useState(2000);
  const [dailySummary, setDailySummary] = useState({ calories: 0, protein: 0, carbs: 0, fats: 0 });
  const fileInputRef = useRef(null);

  // On mount, load stored meals only if they're from today.
  useEffect(() => {
    const storedData = JSON.parse(localStorage.getItem("foodData")) || [];
    const storedTarget = JSON.parse(localStorage.getItem("dailyTarget")) || 2000;
    setDailyTarget(storedTarget);

    if (storedData.length > 0) {
      const lastMealDate = new Date(storedData[0].date).toDateString();
      const today = new Date().toDateString();
      if (lastMealDate === today) {
        setFoodData(storedData);
        calculateSummary(storedData);
      } else {
        localStorage.removeItem("foodData");
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("foodData", JSON.stringify(foodData));
    calculateSummary(foodData);
  }, [foodData]);

  useEffect(() => {
    localStorage.setItem("dailyTarget", JSON.stringify(dailyTarget));
  }, [dailyTarget]);

  const handleFileInputChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result.split(",")[1];
        setImage(base64);
        setPreview(reader.result);
        await handleAnalyze(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyze = async (img) => {
    const imageToAnalyze = img || image;
    if (!imageToAnalyze) return;
    setLoading(true);

    try {
      const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GOOGLE_API_KEY);
      const model = genAI.getGenerativeModel({ model: "models/gemini-1.5-pro" });

      const prompt = `Analyze this food image. Identify all food items present and return a structured JSON response with each food's name, calories, protein, carbs, and fats. 
Example response:
{
  "foods": [
    { "name": "Grilled Chicken", "calories": 250, "protein": 30, "carbs": 2, "fats": 10 },
    { "name": "Rice", "calories": 200, "protein": 5, "carbs": 45, "fats": 1 }
  ]
}
If the image is unclear or contains no food, respond with:
{ "error": "Unable to detect food items. Please try another image." }
 just give the json content and not anything else this is very strict criteria for your response
`;

      const result = await model.generateContent([
        { inlineData: { data: imageToAnalyze, mimeType: "image/jpeg" } },
        prompt,
      ]);

      const responseText = await result.response.text();
      console.log(responseText);
      let cleanedResponse = responseText.trim();

      // Remove the opening ```json marker if it exists.
      if (cleanedResponse.startsWith("```json")) {
        cleanedResponse = cleanedResponse.substring(7).trim();
      }
      
      // Remove the closing ``` marker if it exists.
      if (cleanedResponse.endsWith("```")) {
        cleanedResponse = cleanedResponse.substring(0, cleanedResponse.length - 3).trim();
      }
      console.log(cleanedResponse)
      const jsonResponse = JSON.parse(cleanedResponse);


      if (jsonResponse.error) {
        alert(jsonResponse.error);
      } else {
        const today = new Date().toDateString();
        // If meals exist and they're from a different day, clear them.
        if (foodData.length > 0 && new Date(foodData[0].date).toDateString() !== today) {
          setFoodData([]);
        }
        // Compute total macros for the meal.
        const totalMacros = jsonResponse.foods.reduce(
          (acc, food) => {
            acc.calories += food.calories;
            acc.protein += food.protein;
            acc.carbs += food.carbs;
            acc.fats += food.fats;
            return acc;
          },
          { calories: 0, protein: 0, carbs: 0, fats: 0 }
        );

        const roundedMacros = {
          calories: Math.round(totalMacros.calories),
          protein: Math.round(totalMacros.protein),
          carbs: Math.round(totalMacros.carbs),
          fats: Math.round(totalMacros.fats)
        };

        const newMeal = {
          date: today,
          foods: jsonResponse.foods,
          totalMacros: roundedMacros,
        };

        setFoodData([...foodData, newMeal]);
      }
    } catch (error) {
      console.error("Error analyzing image:", error);
      alert("Failed to analyze image. Please try again.");
    }

    setLoading(false);
  };

  // Compute overall daily summary by summing macros from all meals.
  const calculateSummary = (data) => {
    const summary = data.reduce(
      (acc, meal) => {
        meal.foods.forEach((food) => {
          acc.calories += food.calories;
          acc.protein += food.protein;
          acc.carbs += food.carbs;
          acc.fats += food.fats;
        });
        return acc;
      },
      { calories: 0, protein: 0, carbs: 0, fats: 0 }
    );
    setDailySummary({
      calories: Math.round(summary.calories),
      protein: Math.round(summary.protein),
      carbs: Math.round(summary.carbs),
      fats: Math.round(summary.fats)
    });
  };

  const handleRemoveMeal = (index) => {
    if (window.confirm("Are you sure you want to remove this meal?")) {
      setFoodData(prev => prev.filter((_, i) => i !== index));
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center p-8 dark">
      <h1 className="text-3xl font-bold mb-8">Food Tracker</h1>

      {/* Daily Target Card */}
      <Card className="w-full max-w-lg mb-6">
        <CardHeader>
          <CardTitle>Set Daily Calorie Target</CardTitle>
        </CardHeader>
        <CardContent>
          <Input 
            type="number"
            value={dailyTarget}
            onChange={(e) => setDailyTarget(Number(e.target.value))}
            className="w-full"
          />
        </CardContent>
      </Card>

      {/* Add Meal Button */}
      <Card className="w-full max-w-lg mb-6">
        <CardContent>
          <Button onClick={() => fileInputRef.current.click()} className="w-full mt-5">
            {loading ? "Processing..." : "Add Meal"}
          </Button>
          <input
            type="file"
            accept="image/*"
            capture
            ref={fileInputRef}
            onChange={handleFileInputChange}
            className="hidden"
          />
        </CardContent>
      </Card>

      {/* Daily Intake Summary Card */}
      <Card className="w-full max-w-lg mb-6">
        <CardHeader>
          <CardTitle>Daily Intake Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Calories: {dailySummary.calories} / {dailyTarget} kcal</p>
          <p>Protein: {dailySummary.protein}g</p>
          <p>Carbs: {dailySummary.carbs}g</p>
          <p>Fats: {dailySummary.fats}g</p>
          <div className="w-full bg-muted h-3 rounded mt-3">
            <div
              className="bg-primary h-3 rounded"
              style={{ width: `${(dailySummary.calories / dailyTarget) * 100}%`, maxWidth: "100%" }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Meals Recorded */}
      <div className="w-full max-w-lg">
        <Card>
          <CardHeader>
            <CardTitle>Today's Meals</CardTitle>
          </CardHeader>
          <CardContent>
            {foodData.length === 0 ? (
              <p >No meals added yet.</p>
            ) : (
              <>
                <div className="mb-4">
                  <h3 className="text-lg font-medium">{foodData[0].date}</h3>
                </div>
                <div className="space-y-4">
                  {foodData.map((meal, index) => (
                    <Card key={index} className="relative">
                      <CardHeader className="flex justify-between items-center">
                        <CardTitle className="text-base font-medium">Meal {index + 1}</CardTitle>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm">Total: {meal.totalMacros.calories} kcal</span>
                          <Button
                            variant="destructive"
                            size="icon"
                            onClick={() => handleRemoveMeal(index)}
                            className="absolute top-3 right-3"
                          >
                            <X className="h-4 w-4 " />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm mb-2">
                          Protein: {meal.totalMacros.protein}g | Carbs: {meal.totalMacros.carbs}g | Fats: {meal.totalMacros.fats}g
                        </p>
                        <ul className="list-disc pl-5 text-sm">
                          {meal.foods.map((food, i) => (
                            <li key={i}>
                              {food.name}: {food.calories} kcal
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
