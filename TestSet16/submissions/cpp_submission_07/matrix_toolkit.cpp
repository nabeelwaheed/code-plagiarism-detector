#include "matrix_toolkit.hpp"

#include <iomanip>
#include <iostream>
#include <stdexcept>

Matrix readMatrix(int rows, int cols) {
    Matrix m(rows, std::vector<double>(cols, 0.0));
    for (int r = 0; r < rows; ++r) {
        for (int c = 0; c < cols; ++c) {
            std::cin >> m[r][c];
        }
    }
    return m;
}

Matrix add(const Matrix &a, const Matrix &b) {
    if (a.size() != b.size() || a[0].size() != b[0].size()) {
        throw std::runtime_error("dimension mismatch in add");
    }

    Matrix out = a;
    for (std::size_t r = 0; r < a.size(); ++r) {
        for (std::size_t c = 0; c < a[r].size(); ++c) {
            out[r][c] = a[r][c] + b[r][c];
        }
    }
    return out;
}

Matrix multiply(const Matrix &a, const Matrix &b) {
    if (a.empty() || b.empty() || a[0].size() != b.size()) {
        throw std::runtime_error("dimension mismatch in multiply");
    }

    Matrix out(a.size(), std::vector<double>(b[0].size(), 0.0));

    for (std::size_t i = 0; i < a.size(); ++i) {
        for (std::size_t k = 0; k < b.size(); ++k) {
            for (std::size_t j = 0; j < b[0].size(); ++j) {
                out[i][j] += a[i][k] * b[k][j];
            }
        }
    }

    return out;
}

Matrix transpose(const Matrix &m) {
    if (m.empty()) {
        return Matrix{};
    }

    Matrix out(m[0].size(), std::vector<double>(m.size(), 0.0));
    for (std::size_t r = 0; r < m.size(); ++r) {
        for (std::size_t c = 0; c < m[r].size(); ++c) {
            out[c][r] = m[r][c];
        }
    }
    return out;
}

double trace(const Matrix &m) {
    if (m.empty() || m.size() != m[0].size()) {
        throw std::runtime_error("trace requires square matrix");
    }

    double t = 0.0;
    for (std::size_t i = 0; i < m.size(); ++i) {
        t += m[i][i];
    }
    return t;
}

void printMatrix(const Matrix &m) {
    for (const auto &row : m) {
        for (double v : row) {
            std::cout << std::setw(10) << std::fixed << std::setprecision(2) << v << ' ';
        }
        std::cout << '\n';
    }
}
