import { Request, Response } from "express";
import { ApiResponse } from "../types/api.types";
import {
  SearchResponse,
  SearchQueryType,
  searchQuerySchema,
  PlainProduct,
} from "../types/search.types";
import Product from "../models/productSchema";
import { formatZodError } from "../utils/errorUtils";
import redisClient from "../utils/redisUtils";

export const searchProducts = async (
  req: Request<{}, ApiResponse<SearchResponse>, {}, SearchQueryType>,
  res: Response<ApiResponse<SearchResponse>>
): Promise<void> => {
  try {
    const validationResult = searchQuerySchema.safeParse(req.query);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "Invalid search parameters",
        errors: formatZodError(validationResult.error),
      });
      return;
    }

    const {
      q,
      category,
      minPrice,
      maxPrice,
      brand,
      limit = "10",
      page = "1",
      suggest,
    } = validationResult.data;

    //  auto-suggestion request
    if (suggest === "true") {
      const suggestionCacheKey = `suggestions:${q}`;
      const cachedSuggestions = await redisClient.getCachedSearchResults(
        suggestionCacheKey,
        {}
      );

      if (cachedSuggestions) {
        res.status(200).json({
          success: true,
          data: cachedSuggestions,
        });
        return;
      }
      //  regex for auto-suggestions
      const suggestions = await Product.find(
        {
          name: {
            $regex: `^${q}`,
            $options: "i",
          },
        },
        { name: 1, _id: 0 }
      )
        .limit(5)
        .lean()
        .exec();

      const suggestionResponse = {
        products: [],
        totalResults: 0,
        suggestions: suggestions.map((item) => item.name),
        facets: { categories: [], brands: [], priceRanges: [] },
      };

      await redisClient.cacheSearchResults(
        suggestionCacheKey,
        {},
        suggestionResponse
      );

      res.status(200).json({
        success: true,
        data: suggestionResponse,
      });
      return;
    }

    const filters = {
      category,
      minPrice,
      maxPrice,
      brand,
      limit,
      page,
    };

    const cachedResults = await redisClient.getCachedSearchResults(q, filters);
    if (cachedResults) {
      res.status(200).json({
        success: true,
        data: cachedResults,
        message: "Search results retrieved from cache",
      });
      return;
    }

    // search query
    const searchQuery: any = {
      $and: [
        {
          $or: [
            {
              name: {
                $regex: q.split(/\s+/).join("|"),
                $options: "i",
              },
            },
            {
              description: {
                $regex: q.split(/\s+/).join("|"),
                $options: "i",
              },
            },
          ],
        },
      ],
    };

    // filters
    if (category) {
      searchQuery.$and.push({ category });
    }

    if (brand) {
      searchQuery.$and.push({ brand });
    }

    if (minPrice || maxPrice) {
      const priceQuery: any = {};
      if (minPrice) priceQuery.$gte = parseInt(minPrice);
      if (maxPrice) priceQuery.$lte = parseInt(maxPrice);
      searchQuery.$and.push({ price: priceQuery });
    }

    // Calculate pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    //  main search query with facets
    const [searchResults, facets] = await Promise.all([
      Product.find(searchQuery).skip(skip).limit(limitNum).lean().exec(),
      Product.aggregate([
        { $match: searchQuery },
        {
          $facet: {
            categories: [
              { $group: { _id: "$category", count: { $sum: 1 } } },
              { $sort: { count: -1 } },
            ],
            brands: [
              { $group: { _id: "$brand", count: { $sum: 1 } } },
              { $sort: { count: -1 } },
            ],
            priceRanges: [
              {
                $bucket: {
                  groupBy: "$price",
                  boundaries: [0, 5000, 15000, 50000, 100000, 500000],
                  default: "500000+",
                  output: {
                    count: { $sum: 1 },
                    minPrice: { $min: "$price" },
                    maxPrice: { $max: "$price" },
                  },
                },
              },
            ],
          },
        },
      ]),
    ]);

    const totalResults = await Product.countDocuments(searchQuery);

    const results = searchResults as unknown as PlainProduct[];

    const searchResponse = {
      products: results,
      totalResults,
      facets: facets[0],
    };

    await redisClient.cacheSearchResults(q, filters, searchResponse);

    res.status(200).json({
      success: true,
      data: searchResponse,
      message: "Search results retrieved successfully",
    });
  } catch (error) {
    console.error("Error in searchProducts:", error);
    res.status(500).json({
      success: false,
      message: "Failed to perform search",
    });
  }
};
