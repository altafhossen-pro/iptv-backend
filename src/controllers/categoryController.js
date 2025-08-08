// controllers/categoryController.js
const Category = require('../models/Category');
const Channel = require('../models/Channel');
const sendResponse = require('../utils/sendResponse');

// Get all active categories
exports.getAllCategories = async (req, res) => {
    try {
        const categories = await Category.getActiveCategories();

        // Get channel count for each category
        const categoriesWithCounts = await Promise.all(
            categories.map(async (category) => {
                const channelCount = await Channel.countDocuments({
                    category_id: category._id,
                    status: 'active',
                    is_online: true
                });

                return {
                    ...category.toObject(),
                    channelCount
                };
            })
        );

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'Categories retrieved successfully',
            data: categoriesWithCounts
        });

    } catch (error) {
        console.error('Get categories error:', error);
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Server error while retrieving categories'
        });
    }
};

// Get single category with channels
exports.getCategoryById = async (req, res) => {
    try {
        const { categoryId } = req.params;
        const { page = 1, limit = 20 } = req.query;
        const skip = (page - 1) * limit;

        const category = await Category.findOne({
            _id: categoryId,
            status: 'active'
        });

        if (!category) {
            return sendResponse({
                res,
                statusCode: 404,
                success: false,
                message: 'Category not found'
            });
        }

        // Get channels in this category
        const channels = await Channel.find({
            category_id: categoryId,
            status: 'active',
            is_online: true
        })
            .sort({ sort_order: 1, name: 1 })
            .limit(parseInt(limit))
            .skip(parseInt(skip));

        const totalChannels = await Channel.countDocuments({
            category_id: categoryId,
            status: 'active',
            is_online: true
        });

        const pagination = {
            current_page: parseInt(page),
            total_pages: Math.ceil(totalChannels / limit),
            total_records: totalChannels,
            per_page: parseInt(limit)
        };

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'Category details retrieved successfully',
            data: {
                category,
                channels
            },
            pagination
        });

    } catch (error) {
        console.error('Get category error:', error);
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Server error while retrieving category'
        });
    }
};

// Get category by slug
exports.getCategoryBySlug = async (req, res) => {
    try {
        const { slug } = req.params;
        const { page = 1, limit = 20 } = req.query;
        const skip = (page - 1) * limit;

        const category = await Category.findOne({
            slug: slug,
            status: 'active'
        });

        if (!category) {
            return sendResponse({
                res,
                statusCode: 404,
                success: false,
                message: 'Category not found'
            });
        }

        // Get channels in this category
        const channels = await Channel.find({
            category_id: category._id,
            status: 'active',
            is_online: true
        })
            .sort({ sort_order: 1, name: 1 })
            .limit(parseInt(limit))
            .skip(parseInt(skip));

        const totalChannels = await Channel.countDocuments({
            category_id: category._id,
            status: 'active',
            is_online: true
        });

        const pagination = {
            current_page: parseInt(page),
            total_pages: Math.ceil(totalChannels / limit),
            total_records: totalChannels,
            per_page: parseInt(limit)
        };

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'Category details retrieved successfully',
            data: {
                category,
                channels
            },
            pagination
        });

    } catch (error) {
        console.error('Get category by slug error:', error);
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Server error while retrieving category'
        });
    }
};

exports.createCategory = async (req, res) => {
    try {
        const { name, description, icon, sort_order } = req.body;

        // Validate required fields
        if (!name || name.trim().length === 0) {
            return sendResponse({
                res,
                statusCode: 400,
                success: false,
                message: 'Category name is required'
            });
        }

        // Check if category with same name already exists
        const existingCategory = await Category.findOne({
            name: { $regex: new RegExp('^' + name.trim() + '$', 'i') }
        });

        if (existingCategory) {
            return sendResponse({
                res,
                statusCode: 400,
                success: false,
                message: 'Category with this name already exists'
            });
        }

        const category = new Category({
            name: name.trim(),
            description: description?.trim() || '',
            icon,
            sort_order: sort_order || 0,
            status: 'active'
        });

        await category.save();

        return sendResponse({
            res,
            statusCode: 201,
            success: true,
            message: 'Category created successfully',
            data: category
        });

    } catch (error) {
        console.error('Create category error:', error);

        // Handle duplicate key error
        if (error.code === 11000) {
            const field = Object.keys(error.keyPattern)[0];
            return sendResponse({
                res,
                statusCode: 400,
                success: false,
                message: `Category ${field} already exists`
            });
        }

        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Server error while creating category'
        });
    }
};

// Update category
exports.updateCategory = async (req, res) => {
    try {
        const { categoryId } = req.params;
        const { name, description, icon, sort_order } = req.body;

        const category = await Category.findById(categoryId);
        if (!category) {
            return sendResponse({
                res,
                statusCode: 404,
                success: false,
                message: 'Category not found'
            });
        }

        // Check if new name conflicts with existing category
        if (name && name.trim() !== category.name) {
            const existingCategory = await Category.findOne({
                name: { $regex: new RegExp('^' + name.trim() + '$', 'i') },
                _id: { $ne: categoryId }
            });

            if (existingCategory) {
                return sendResponse({
                    res,
                    statusCode: 400,
                    success: false,
                    message: 'Category with this name already exists'
                });
            }
        }

        // Update fields
        if (name) category.name = name.trim();
        if (description !== undefined) category.description = description.trim();
        if (icon !== undefined) category.icon = icon;
        if (sort_order !== undefined) category.sort_order = sort_order;

        await category.save();

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'Category updated successfully',
            data: category
        });

    } catch (error) {
        console.error('Update category error:', error);

        if (error.code === 11000) {
            const field = Object.keys(error.keyPattern)[0];
            return sendResponse({
                res,
                statusCode: 400,
                success: false,
                message: `Category ${field} already exists`
            });
        }

        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Server error while updating category'
        });
    }
};

// Delete category
exports.deleteCategory = async (req, res) => {
    try {
        const { categoryId } = req.params;

        const category = await Category.findById(categoryId);
        if (!category) {
            return sendResponse({
                res,
                statusCode: 404,
                success: false,
                message: 'Category not found'
            });
        }

        // Check if category has associated channels
        const channelCount = await Channel.countDocuments({ category_id: categoryId });
        if (channelCount > 0) {
            return sendResponse({
                res,
                statusCode: 400,
                success: false,
                message: `Cannot delete category. ${channelCount} channels are associated with this category`
            });
        }

        await Category.findByIdAndDelete(categoryId);

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'Category deleted successfully'
        });

    } catch (error) {
        console.error('Delete category error:', error);
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Server error while deleting category'
        });
    }
};

// Update category status
exports.updateCategoryStatus = async (req, res) => {
    try {
        const { categoryId } = req.params;
        const { status } = req.body;

        if (!['active', 'inactive'].includes(status)) {
            return sendResponse({
                res,
                statusCode: 400,
                success: false,
                message: 'Invalid status. Must be either "active" or "inactive"'
            });
        }

        const category = await Category.findByIdAndUpdate(
            categoryId,
            { status },
            { new: true }
        );

        if (!category) {
            return sendResponse({
                res,
                statusCode: 404,
                success: false,
                message: 'Category not found'
            });
        }

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: `Category ${status === 'active' ? 'activated' : 'deactivated'} successfully`,
            data: category
        });

    } catch (error) {
        console.error('Update category status error:', error);
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Server error while updating category status'
        });
    }
};