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

const getPrevDate = function (date) {
    var newDate = new Date(date)
    newDate.setDate(newDate.getDate() - 1)
    return newDate
}

const getNextDate = function (date) {
    var newDate = new Date(date)
    newDate.setDate(newDate.getDate() + 1)
    return newDate
}

function isEmpty(obj) {
    return Object.keys(obj).length === 0;
}

module.exports = {
    capitalize: capitalize,
    formatDate: formatDate,
    prevDate: getPrevDate,
    nextDate: getNextDate,
    isEmpty: isEmpty
}