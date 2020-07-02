const capitalize = function (string) {
    return string
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
}

const formatDate = function (data) {
    data['createdDate'] = data['createdDate'].toDate()
    data['lastUpdatedDate'] = data['lastUpdatedDate'].toDate()
    return data
}

module.exports = {
    capitalize: capitalize,
    formatDate: formatDate
}